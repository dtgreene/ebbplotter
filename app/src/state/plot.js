import { proxy } from 'valtio';
import debounce from 'lodash.debounce';

import { storedPlotState } from './storedPlot';
import { postRequest } from '../utils';

export const plotState = proxy({
  preview: {
    isLoading: false,
    isError: false,
    data: null,
    prevBody: null,
  },
  excludeIds: [],
  reset() {
    this.preview.isLoading = false;
    this.preview.isError = false;
    this.preview.data = null;
    this.preview.prevBody = null;
    this.excludeIds = [];
  },
});

export function getPreview() {
  const { currentFile } = storedPlotState;

  if (!currentFile) return;
  if (plotState.preview.isLoading) return;

  const { data } = currentFile;
  const {
    dimensions,
    margins,
    alignment,
    rotation,
    useBoundingBox,
    optimizations,
  } = storedPlotState;
  const {
    merge,
    mergeDistance,
    removeShort,
    removeShortDistance,
    reorder,
    randomizeStart,
    randomizeStartTolerance,
  } = optimizations;
  const { excludeIds } = plotState;
  const body = JSON.stringify({
    data,
    dimensions: {
      width: Number(dimensions.width),
      height: Number(dimensions.height),
    },
    margins: {
      top: Number(margins.top),
      right: Number(margins.right),
      bottom: Number(margins.bottom),
      left: Number(margins.left),
    },
    alignment: Number(alignment),
    rotation: Number(rotation),
    useBoundingBox,
    optimizations: {
      merge,
      mergeDistance: Number(mergeDistance),
      removeShort,
      removeShortDistance: Number(removeShortDistance),
      reorder,
      randomizeStart,
      randomizeStartTolerance: Number(randomizeStartTolerance),
    },
    excludeIds,
  });

  if (body !== plotState.preview.prevBody) {
    plotState.preview.prevBody = body;

    postRequest(plotState.preview, '/preview', body);
  }
}

export const debouncedGetPreview = debounce(getPreview, 400);
