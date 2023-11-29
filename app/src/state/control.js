import { proxy } from 'valtio';

import { storedPlotState } from './storedPlot';
import { postRequest } from '../utils';

export const controlState = proxy({
  request: {
    isLoading: false,
    isError: false,
    data: null,
  },
});

export function setPen(heightPercent) {
  if (controlState.request.isLoading) return;

  const { servo } = storedPlotState.machine;
  const body = JSON.stringify({
    minPosition: Number(servo.minPosition),
    maxPosition: Number(servo.maxPosition),
    heightPercent: Number(heightPercent),
    rate: Number(servo.rate),
    duration: Number(servo.duration),
  });
  postRequest(controlState.request, '/control/set-pen', body);
}

export function enableMotors() {
  if (controlState.request.isLoading) return;

  const { stepper } = storedPlotState.machine;
  const body = JSON.stringify({ stepMode: stepper.stepMode });
  postRequest(controlState.request, '/control/enable-motors', body);
}

export function disableMotors() {
  if (controlState.request.isLoading) return;

  postRequest(controlState.request, '/control/disable-motors');
}

export function jog(x, y) {
  if (controlState.request.isLoading) return;

  const { stepper } = storedPlotState.machine;
  const { stepsPerMM, stepMode, invertX, invertY, coreXY } = stepper;

  const body = JSON.stringify({
    x: Number(x),
    y: Number(y),
    stepper: {
      stepsPerMM: Number(stepsPerMM),
      stepMode,
      invertX,
      invertY,
      coreXY,
    },
    speed: Number(storedPlotState.jogSpeed),
  });
  postRequest(controlState.request, '/control/jog', body);
}

export function rebootBoard() {
  if (controlState.request.isLoading) return;

  postRequest(controlState.request, '/control/reboot');
}

export function eStop() {
  postRequest(controlState.request, '/control/stop');
}
