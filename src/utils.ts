import colors from 'colors';

export function debugLog(message: string) {
  log(colors.green(message));
}

export function log(message: string) {
  console.log(`[EBBPLOTTER]: ${message}`);
}

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
  stop2: number
) {
  return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}
