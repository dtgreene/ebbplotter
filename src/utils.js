import logger from 'loglevel';

import {
  SEGMENT_OPTIONS,
  OPTIMIZATION_OPTIONS,
  WORK_AREA_DIMENSIONS,
} from './constants.js';
import { segment } from './lib/segment/segment.js';
import { round } from './lib/optimize/round.js';
import { simplify } from './lib/optimize/simplify.js';
import { sort } from './lib/optimize/sort.js';
import { randomizeStart } from './lib/optimize/randomizeStart.js';

/**
 * Calculates the distance between two points
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns
 */
export function distanceTo(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

/**
 * Remaps a number from one range to another
 * @param {number} n
 * @param {number} start1
 * @param {number} stop1
 * @param {number} start2
 * @param {number} stop2
 * @returns
 */
export function remap(n, start1, stop1, start2, stop2) {
  return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}

/**
 *
 * @param {number} duration
 * The duration to wait in milliseconds
 * @returns
 */
export function wait(duration) {
  return new Promise((res) => setTimeout(res, duration));
}

function parseViewBox(data) {
  try {
    const viewBox = data.match(/viewBox="(.*)"/);

    if (!viewBox[1]) {
      throw new Error('Attribute not found');
    }

    // parse the width and height from the viewBox attribute
    const [width, height] = viewBox[1].split(' ').slice(2);

    if (!width || !height) {
      throw new Error('Attribute invalid');
    }

    return { width: parseFloat(width), height: parseFloat(height) };
  } catch (e) {
    throw new Error(`Could not parse viewBox: ${e.message}`);
  }
}

export function pointInBounds(x, y, dimensions) {
  return x <= dimensions.width && y <= dimensions.height;
}

export function percentBetween(min, max, percent) {
  return (max - min) * (percent * 0.01) + min;
}

export function segmentSVG(data, outWidth, selector) {
  const {
    recursion,
    epsilon,
    pathEpsilon,
    angleEpsilon,
    angleTolerance,
    cuspLimit,
  } = SEGMENT_OPTIONS;

  let paths = segment(data, {
    recursion,
    epsilon,
    pathEpsilon,
    angleEpsilon,
    angleTolerance,
    cuspLimit,
  });

  // select certain paths
  if (selector) {
    paths = paths.filter(selector);
  }

  // get only the segments, i.e. discard stroke, fill, etc.
  let segments = paths.reduce(
    (acc, current) => acc.concat(current.segments),
    []
  );

  // parse the view box
  const viewBox = parseViewBox(data);

  // the ratio of the segments's width to the height
  const ratio = viewBox.width / viewBox.height;
  // the final dimensions determined by the out width
  const outDimensions = {
    width: outWidth,
    height: outWidth / ratio,
  };

  // it's possible that scaling will exceed the work area
  if (outDimensions.height > WORK_AREA_DIMENSIONS.height) {
    outDimensions.height = WORK_AREA_DIMENSIONS.height;
    outDimensions.width = outDimensions.height * ratio;

    logger.warn(
      'The dimensions have been scaled back to stay within the work area'
    );
  }

  // scale the segments to the out width
  segments = segments.reduce((acc, current) => {
    const result = [];

    for (let i = 0; i < current.length; i += 2) {
      const xRatio = current[i] / viewBox.width;
      const yRatio = current[i + 1] / viewBox.height;

      const x = outDimensions.width * xRatio;
      const y = outDimensions.height * yRatio;

      result.push(x, y);
    }

    acc.push(result);

    return acc;
  }, []);

  // optimizations
  if (OPTIMIZATION_OPTIONS.simplify.enabled) {
    segments = simplify(segments, OPTIMIZATION_OPTIONS.simplify);
  }
  if (OPTIMIZATION_OPTIONS.randomizeStart.enabled) {
    segments = randomizeStart(segments);
  }
  if (OPTIMIZATION_OPTIONS.sort.enabled) {
    segments = sort(segments);
  }
  if (OPTIMIZATION_OPTIONS.round.enabled) {
    segments = round(segments, OPTIMIZATION_OPTIONS.round.precision);
  }

  return segments;
}
