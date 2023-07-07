import SvgPath from 'svgpath';
import logger from 'loglevel';

import config from '../config.ebb.js';
import { parse } from './parse.js';
import { shapeToPath } from './shapeToPath.js';
import { simplify } from './optimize/simplify.js';
import { randomizeStart } from './optimize/randomizeStart.js';
import { sort } from './optimize/sort.js';

import createBezierBuilder from 'adaptive-bezier-curve/function.js';

export function getVectorSegments(data, options) {
  const { selector, outputWidth } = options;
  const {
    machineDimensions,
    segment: { bezierOptions, optimizations },
  } = config;

  const shapes = parse(data);
  const segmentBezier = createBezierBuilder(bezierOptions);
  const viewBox = parseViewBox(data);

  let segments = [];

  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    let pathData = '';

    // Get the path data for the shape
    if (shape.tag === 'path') {
      pathData = shape.d;
    } else if (shapeToPath[shape.tag]) {
      pathData = shapeToPath[shape.tag](shape);
    } else {
      logger.warn(`Found unsupported shape tag while segmenting: ${shape.tag}`);
      continue;
    }

    // Create the path instance
    const pathInstance = new SvgPath(pathData);

    // Apply accumulated transformations
    if (shape.transform) {
      pathInstance.transform(shape.transform);
    }

    // - Convert arc commands to curve commands
    // - Convert shorthand curve commands to full definitions
    // - Convert all commands to absolute
    pathInstance.unarc().unshort().abs();

    // Reduce the command range from MCLHVQZ to MLCZ
    pathInstance.iterate(reducePath);

    const path = {
      segments: segmentPath(pathInstance, segmentBezier),
    };

    // Copy over display properties
    ['stroke', 'fill', 'id'].forEach((key) => {
      if (shape[key]) {
        path[key] = shape[key];
      }
    });

    // Only add paths with at least one segment
    if (path.segments.length > 0) {
      segments.push(path);
    } else {
      logger.warn('Found empty path while segmenting');
    }
  }

  // Select certain paths
  if (selector) {
    segments = segments.filter(selector);
  }

  // Reduce down to only the segments; discard stroke, fill, etc.
  segments = segments.reduce(
    (acc, current) => acc.concat(current.segments),
    []
  );

  // Determine the final dimensions
  const ratio = viewBox.width / viewBox.height;
  const outDimensions = {
    width: outputWidth,
    height: outputWidth / ratio,
  };

  // Check that scaling hasn't exceeded the area limits
  if (outDimensions.height > machineDimensions.height) {
    outDimensions.height = machineDimensions.height;
    outDimensions.width = outDimensions.height * ratio;

    logger.warn(
      'The dimensions have been scaled back to stay within the work area'
    );
  }

  // Scale the segments
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

  // Perform optimizations
  if (!optimizations.simplify.disabled) {
    segments = simplify(segments, optimizations.simplify);
  }
  if (!optimizations.randomizeStart.disabled) {
    segments = randomizeStart(segments);
  }
  if (!optimizations.sort.disabled) {
    segments = sort(segments);
  }

  return segments;
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

function reducePath(segment, _, currentX, currentY) {
  const command = segment[0];

  switch (command) {
    case 'H': {
      return [['L', segment[1], currentY]];
    }
    case 'V': {
      return [['L', currentX, segment[1]]];
    }
    case 'Q': {
      const [x1, y1, x, y] = segment.slice(1);

      const cx1 = currentX + (2 * (x1 - currentX)) / 3;
      const cy1 = currentY + (2 * (y1 - currentY)) / 3;
      const cx2 = x + (2 * (x1 - x)) / 3;
      const cy2 = y + (2 * (y1 - y)) / 3;

      return [['C', cx1, cy1, cx2, cy2, x, y]];
    }
    default: {
      return [segment];
    }
  }
}

function segmentPath(path, segmentBezier) {
  const result = [];

  let currentSegment = [];
  let closeSegment = null;

  path.iterate((segment, _, currentX, currentY) => {
    const command = segment[0];

    switch (command) {
      case 'M': {
        // if there's a running segment, end the segment and add to the result
        if (currentSegment.length > 0) {
          result.push(currentSegment);
        }
        currentSegment = [segment[1], segment[2]];
        closeSegment = [segment[1], segment[2]];
        break;
      }
      case 'L': {
        currentSegment.push(segment[1], segment[2]);
        break;
      }
      case 'C': {
        const [x1, y1, x2, y2, x3, y3] = segment.slice(1);
        currentSegment.push(
          ...segmentBezier(
            [currentX, currentY],
            [x1, y1],
            [x2, y2],
            [x3, y3]
          ).reduce((acc, current) => acc.concat(current), [])
        );
        break;
      }
      case 'Z': {
        if (closeSegment) {
          currentSegment.push(closeSegment[0], closeSegment[1]);
        }
        break;
      }
      default: {
        throw new Error(`Encountered unsupported path command: ${command}`);
      }
    }
  });

  // only add segments with at least two points
  if (currentSegment.length > 1) {
    result.push(currentSegment);
  }

  return result;
}
