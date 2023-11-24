import { proxy } from 'valtio';
import debounce from 'lodash.debounce';

import { storedAppState } from './storedApp';
import { createAlert, AlertTypes } from './alert';

const GET_PREVIEW_WAIT = 500;

export const appState = proxy({
  preview: {
    isLoading: false,
    isError: false,
    data: null,
    prevBody: null,
  },
  targetIds: [],
  reset() {
    this.preview = {
      isLoading: false,
      isError: false,
      data: null,
    };
    this.targetIds = [];
  },
});

export async function getPreview() {
  const { currentFile } = storedAppState;

  if (!currentFile) return;
  if (appState.preview.isLoading) return;

  const { data } = currentFile;
  const { dimensions, margins, rotation } = storedAppState;
  const { targetIds } = appState;
  const body = JSON.stringify({
    data,
    dimensions: {
      width: Number(dimensions.width) || 0,
      height: Number(dimensions.height) || 0,
    },
    margins: {
      top: Number(margins.top) || 0,
      right: Number(margins.right) || 0,
      bottom: Number(margins.bottom) || 0,
      left: Number(margins.left) || 0,
    },
    rotation: Number(rotation) || 0,
    targetIds,
  });

  if (body !== appState.preview.prevBody) {
    appState.preview.isLoading = true;
    appState.preview.prevBody = body;

    try {
      const result = await fetch(`${storedAppState.serverURL}/preview`, {
        method: 'POST',
        body,
      });
      const json = await result.json();

      if (result.status !== 200) {
        throw new Error(json);
      }

      appState.preview.isError = false;
      appState.preview.data = json;
    } catch (error) {
      appState.preview.isError = true;
      createAlert({
        title: 'Uh oh...',
        message: 'Could not get SVG preview.',
        type: AlertTypes.ERROR,
      });
      console.error(`Could not get SVG preview: ${error.message}`);
    } finally {
      appState.preview.isLoading = false;
    }
  }
}

export const debouncedGetPreview = debounce(getPreview, GET_PREVIEW_WAIT);
