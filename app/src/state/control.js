import { proxy } from 'valtio';

import { appState } from './app';
import { postRequest } from '../utils';

export const controlState = proxy({
  controlRequest: {
    isLoading: false,
    isError: false,
    data: null,
  },
});

export function setPen(heightPercent) {
  if (controlState.controlRequest.isLoading) return;

  const { servo } = appState.machine;
  const body = JSON.stringify({
    minPosition: Number(servo.minPosition),
    maxPosition: Number(servo.maxPosition),
    heightPercent: Number(heightPercent),
    rate: Number(servo.rate),
    duration: Number(servo.duration),
  });
  postRequest(controlState.controlRequest, { path: '/control/set-pen', body });
}

export function enableMotors() {
  if (controlState.controlRequest.isLoading) return;

  const { stepper } = appState.machine;
  const body = JSON.stringify({ stepMode: stepper.stepMode });
  postRequest(controlState.controlRequest, {
    path: '/control/enable-motors',
    body,
  });
}

export function disableMotors() {
  if (controlState.controlRequest.isLoading) return;

  postRequest(controlState.controlRequest, { path: '/control/disable-motors' });
}

export function jog(x, y) {
  if (controlState.controlRequest.isLoading) return;

  const { stepper } = appState.machine;
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
    speed: Number(appState.jogSpeed),
  });
  postRequest(controlState.controlRequest, { path: '/control/jog', body });
}

export function rebootBoard() {
  if (controlState.controlRequest.isLoading) return;

  postRequest(controlState.controlRequest, { path: '/control/reboot' });
}

export function eStop() {
  postRequest(controlState.controlRequest, { path: '/control/stop' });
}
