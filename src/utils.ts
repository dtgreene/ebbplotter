import { PlotterOptions } from './types';
import { MicroSteps } from './constants';

export function percentBetween(min: number, max: number, percent: number) {
  return (max - min) * (percent * 0.01) + min;
}

export function distanceTo(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x1 - x2, y1 - y2);
}

export function remap(
  n: number,
  start1: number,
  stop1: number,
  start2: number,
  stop2: number,
) {
  return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}

export function getStepsPerMM(stepper: PlotterOptions['machine']['stepper']) {
  const { stepMode, stepAngle, beltPitch, toothCount } = stepper;

  const micro = MicroSteps[stepMode];
  const steps = ((360 / stepAngle) * micro) / (beltPitch * toothCount);

  return Math.round(steps);
}

export function pointInBounds(
  x: number,
  y: number,
  machine: PlotterOptions['machine'],
) {
  const { stepper, limits } = machine;
  if (!stepper.swapAxes) {
    return x <= limits.x && y <= limits.y;
  } else {
    return x <= limits.y && y <= limits.x;
  }
}

export function wait(duration: number) {
  return new Promise((res) => setTimeout(res, duration));
}
