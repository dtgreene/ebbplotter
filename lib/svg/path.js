import {
  PATH_MERGE_DISTANCE,
  PATH_MERGE,
  PATH_RANDOMIZE_START,
} from '../config.js';
import { distanceTo } from '../utils.js';

export function postProcess(path, viewBox, dimensions) {
  const postFunctions = [scale];
  const options = { viewBox, dimensions };

  if (PATH_MERGE) {
    postFunctions.push(merge);
  }

  if (PATH_RANDOMIZE_START) {
    postFunctions.push(randomizeStart, merge);
  }

  return postFunctions.reduce(
    (result, processFunction) => processFunction(result, options),
    path
  );
}

export function getBoundingBox(pathList) {
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };

  pathList.forEach((path) => {
    for (let i = 0; i < path.length; i += 2) {
      const x = path[i];
      const y = path[i + 1];

      bounds.minX = Math.min(x, bounds.minX);
      bounds.maxX = Math.max(x, bounds.maxX);
      bounds.minY = Math.min(y, bounds.minY);
      bounds.maxY = Math.max(y, bounds.maxY);
    }
  });

  return bounds;
}

function scale(path, { viewBox, dimensions }) {
  const result = [];

  for (let i = 0; i < path.length; i += 2) {
    const xRatio = path[i] / viewBox.width;
    const yRatio = path[i + 1] / viewBox.height;

    const x = dimensions.width * xRatio;
    const y = dimensions.height * yRatio;

    result.push(x, y);
  }

  return result;
}

function merge(path) {
  let index = 0;

  const result = [];
  const lastIndex = path.length - 2;
  const lastX = path[lastIndex];
  const lastY = path[lastIndex + 1];

  while (index < lastIndex) {
    const x1 = path[index];
    const y1 = path[index + 1];

    result.push(x1, y1);

    let increment = 2;
    let nextIndex = index + increment;
    let x2 = path[nextIndex];
    let y2 = path[nextIndex + 1];

    while (
      nextIndex < path.length - 2 &&
      distanceTo(x1, y1, x2, y2) < PATH_MERGE_DISTANCE
    ) {
      increment += 2;
      nextIndex = index + increment;
      x2 = path[nextIndex];
      y2 = path[nextIndex + 1];
    }

    index += increment;
  }

  // Add the original last point since it was skipped above
  result.push(lastX, lastY);

  // Since the last point was skipped, the second to last point needs to be
  // checked against the last point.
  if (result.length >= 6) {
    const [x1, y1, x2, y2] = result.slice(-4);
    if (distanceTo(x1, y1, x2, y2) < PATH_MERGE_DISTANCE) {
      result.splice(result.length - 4, 2);
    }
  }

  // Match the final point to the start point if the two are really close
  // together. This basically merges the first and last points while not
  // actually removing the last point.
  if (result.length >= 4) {
    if (distanceTo(result[0], result[1], lastX, lastY) < PATH_MERGE_DISTANCE) {
      result[result.length - 2] = result[0];
      result[result.length - 1] = result[1];
    }
  }

  return result;
}

export function randomizeStart(path) {
  // Basically we need to see if this path is a complete loop
  const pathLength = path.length;
  const distance = distanceTo(
    path[0],
    path[1],
    path[pathLength - 2],
    path[pathLength - 1]
  );

  if (distance < PATH_MERGE_DISTANCE) {
    let startIndex = Math.floor(Math.random() * pathLength);

    // The start index must be even
    if (startIndex % 2 !== 0) {
      startIndex++;
    }

    if (startIndex > 1 && startIndex < pathLength - 2) {
      const startingPoint = path.slice(startIndex, startIndex + 2);

      // Recreate the path starting from a new point. We also remove the
      // current ending point and replace it with the new starting point.
      return path
        .slice(startIndex)
        .concat(path.slice(2, startIndex))
        .concat(startingPoint);
    }
  }

  return path;
}
