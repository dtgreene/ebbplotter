import logger from 'loglevel';
import SVGPath from 'svgpath';
import createBezierBuilder from 'adaptive-bezier-curve/function.js';

import { PATH_BEZIER_OPTIONS } from '../config.js';

const segmentBezier = createBezierBuilder(PATH_BEZIER_OPTIONS);

export function getPathData(element) {
  switch (element.tag) {
    case 'path': {
      return element.d;
    }
    case 'rect': {
      return getRect(element);
    }
    case 'circle': {
      return getCircle(element);
    }
    case 'ellipse': {
      return getEllipse(element);
    }
    case 'line': {
      return getLine(element);
    }
    case 'polygon': {
      return getPolygon(element);
    }
    case 'polyline': {
      return getPolyline(element);
    }
    default: {
      return null;
    }
  }
}

export function getPathPoints(data, transform) {
  const result = [];

  let currentSegment = [];
  let closeSegment = null;

  // - Applies all transformations
  // - Converts arc commands to curve commands
  // - Converts smooth curves to generic
  // - Converts all commands from relative to absolute
  // - Reduces the command range from MCLHVQZ to MLCZ
  SVGPath.from(data)
    .transform(transform)
    .unarc()
    .unshort()
    .abs()
    .iterate(reducePath)
    .iterate((segment, _, currentX, currentY) => {
      const command = segment[0];

      switch (command) {
        case 'M': {
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
          currentSegment = currentSegment.concat(
            segmentBezier(
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
          logger.warn(`Encountered unknown path command: ${command}`);
        }
      }
    });

  if (currentSegment.length > 0) {
    result.push(currentSegment);
  }

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

function getNumberProps(element, props) {
  return props.map((prop) => {
    if (typeof element[prop] === 'number') {
      return Number(element[current]);
    } else {
      return 0;
    }
  });
}

function renderPath(values) {
  return values
    .map((value) => (Array.isArray(value) ? value.join(' ') : value))
    .join(' ');
}

function getRect(element) {
  const [x, y, width, height, inputRX, inputRY] = getNumberProps(element, [
    'x',
    'y',
    'width',
    'height',
    'rx',
    'ry',
  ]);

  if (inputRX || inputRY) {
    let rx = !inputRX ? inputRY : inputRX;
    let ry = !inputRY ? inputRX : inputRY;

    if (rx * 2 > width) {
      rx -= (rx * 2 - width) / 2;
    }
    if (ry * 2 > height) {
      ry -= (ry * 2 - height) / 2;
    }

    return renderPath([
      'M',
      [x + rx, y],
      'h',
      [width - rx * 2],
      's',
      [rx, 0, rx, ry],
      'v',
      [height - ry * 2],
      's',
      [0, ry, -rx, ry],
      'h',
      [-width + rx * 2],
      's',
      [-rx, 0, -rx, -ry],
      'v',
      [-height + ry * 2],
      's',
      [0, -ry, rx, -ry],
    ]);
  } else {
    return renderPath([
      'M',
      [x, y],
      'h',
      [width],
      'v',
      [height],
      'H',
      [x],
      'Z',
    ]);
  }
}

function getCircle(element) {
  const [cx, cy, r] = getNumberProps(element, ['cx', 'cy', 'r']);

  return renderPath([
    'M',
    [cx - r, cy],
    'a',
    [r, r, 0, 1, 0, 2 * r, 0],
    'a',
    [r, r, 0, 1, 0, -2 * r, 0],
  ]);
}

function getEllipse(element) {
  const [cx, cy, rx, ry] = getNumberProps(element, ['cx', 'cy', 'rx', 'ry']);

  return renderPath([
    'M',
    [cx - rx, cy],
    'a',
    [rx, ry, 0, 1, 0, 2 * rx, 0],
    'a',
    [rx, ry, 0, 1, 0, -2 * rx, 0],
  ]);
}

function getLine(element) {
  const [x1, x2, y1, y2] = getNumberProps(element, ['x1', 'x2', 'y1', 'y2']);
  return renderPath(['M', [x1, y1], 'L', [x2, y2]]);
}

function getPolygon(element) {
  return getPolyPath(element).concat('Z');
}

function getPolyline(element) {
  return getPolyPath(element);
}

function getPolyPath(element) {
  const { points = '' } = element;
  const data = points.trim().split(/[ ,]+/);

  const path = [];
  for (let i = 0; i < data.length; i += 2) {
    path.push(i === 0 ? 'M' : 'L', [Number(data[i]), Number(data[i + 1])]);
  }

  return renderPath(path);
}
