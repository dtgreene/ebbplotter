import SvgPath from 'svgpath';

import { parse } from './parse.js';
import { shapeToPath } from './shapeToPath.js';
import createBezierBuilder from 'adaptive-bezier-curve/function.js';

export function segment(svg, bezierOptions = { pathEpsilon: 0.5 }) {
  const shapes = parse(svg);
  const result = [];
  const subBezier = createBezierBuilder(bezierOptions);

  shapes.forEach((shape) => {
    let pathData = '';

    // get the path data for the shape
    if (shape.tag === 'path') {
      pathData = shape.d;
    } else if (shapeToPath[shape.tag]) {
      pathData = shapeToPath[shape.tag](shape);
    } else {
      throw new Error(`Encountered unsupported shape tag: ${shape.tag}`);
    }

    // create the path instance
    const pathInstance = new SvgPath(pathData);

    // apply transformations
    if (shape.transform) {
      pathInstance.transform(shape.transform);
    }

    // - convert arc commands to curve commands
    // - convert shorthand curve commands to full definitions
    // - convert all commands to absolute
    pathInstance.unarc().unshort().abs();

    // reduce the commands from MCLHVQZ to MLCZ
    pathInstance.iterate(reducePath);

    const path = {
      segments: segmentPath(pathInstance, subBezier),
    };

    // copy over display properties
    ['stroke', 'fill', 'id'].forEach((key) => {
      if (shape[key]) {
        path[key] = shape[key];
      }
    });

    // only add paths with at least one segment
    if (path.segments.length > 0) {
      result.push(path);
    }
  });

  return result;
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

function segmentPath(path, subBezier) {
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
          ...subBezier(
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
