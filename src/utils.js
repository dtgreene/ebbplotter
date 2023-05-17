import { MICRO_STEP_MODE, SEGMENT_OPTIONS } from './constants.js';
import { segment } from './lib/segment/segment.js';
import { round } from './lib/optimize/round.js';
import { simplify } from './lib/optimize/simplify.js';
import { sort } from './lib/optimize/sort.js';

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
 * Calculates the number of steps per millimeter based on the stepper configuration
 * @param {StepperConfig} stepper
 * @returns
 */
export function getStepsPerMM(stepper) {
  const { stepMode, stepAngle, beltPitch, toothCount } = stepper;

  if (!(stepMode in MICRO_STEP_MODE)) {
    throw new Error('Invalid step mode');
  }

  const micro = MICRO_STEP_MODE[stepMode];
  const steps = ((360 / stepAngle) * micro) / (beltPitch * toothCount);

  return Math.round(steps);
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
  segments = round(segments, SEGMENT_OPTIONS.round.precision);
  segments = simplify(segments, SEGMENT_OPTIONS.simplify);
  segments = sort(segments);

  return segments;
}
