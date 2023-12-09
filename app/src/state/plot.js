import { proxy } from 'valtio';
import debounce from 'lodash.debounce';

import { appState } from './app';
import { postRequest } from '../utils';
import { isDisabled } from '../hooks/useAppDisabled';

export const plotState = proxy({
  previewRequest: {
    isLoading: false,
    isError: false,
    data: null,
    prevBody: null,
  },
  startPlotRequest: {
    isLoading: false,
    isError: false,
    data: null,
  },
  excludeIds: [],
});

export function resetPreview() {
  plotState.previewRequest = {
    isLoading: false,
    isError: false,
    data: null,
    prevBody: null,
  };
  plotState.excludeIds = [];
}

export function getPreview() {
  const { currentFile } = appState;

  if (!currentFile) return;
  if (isDisabled()) return;

  const body = JSON.stringify(getLayoutBody());

  if (body !== plotState.previewRequest.prevBody) {
    plotState.previewRequest.prevBody = body;

    postRequest(plotState.previewRequest, { path: '/preview', body });
  }
}

export const debouncedGetPreview = debounce(getPreview, 400);

export function startPlot() {
  if (isDisabled()) return;

  const body = JSON.stringify({
    layout: getLayoutBody(),
    machine: getMachineBody(),
  });

  postRequest(plotState.startPlotRequest, { path: '/plot', body });
}

function getLayoutBody() {
  const { data } = appState.currentFile;
  const {
    dimensions,
    margins,
    alignment,
    rotation,
    useBoundingBox,
    optimizations,
  } = appState;
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

  return {
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
  };
}

function getMachineBody() {
  const { machine } = appState;
  const { stepper, planning, servo } = machine;
  const { upSpeed, downSpeed, stepsPerMM, stepMode, invertX, invertY, coreXY } =
    stepper;
  const { cornerFactor, acceleration } = planning;
  const { minPosition, maxPosition, upPercent, downPercent, duration, rate } =
    servo;

  return {
    stepper: {
      upSpeed: Number(upSpeed),
      downSpeed: Number(downSpeed),
      stepsPerMM: Number(stepsPerMM),
      stepMode,
      invertX,
      invertY,
      coreXY,
    },
    planning: {
      cornerFactor: Number(cornerFactor),
      acceleration: Number(acceleration),
    },
    servo: {
      minPosition: Number(minPosition),
      maxPosition: Number(maxPosition),
      upPercent: Number(upPercent),
      downPercent: Number(downPercent),
      duration: Number(duration),
      rate: Number(rate),
    },
  };
}
