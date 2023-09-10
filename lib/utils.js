export function distanceTo(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

export function remap(n, start1, stop1, start2, stop2) {
  return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}

export function wait(duration) {
  return new Promise((res) => setTimeout(res, duration));
}

export function pointInBounds(x, y, dimensions) {
  return x <= dimensions.width && y <= dimensions.height;
}

// export function throwError(message, error) {
//   if (error instanceof Error) {
//     throw new Error(`${message}: ${error.message}`);
//   } else {
//     throw new Error(message);
//   }
// }
