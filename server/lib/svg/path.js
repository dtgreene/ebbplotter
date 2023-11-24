import logger from 'loglevel';
import SVGPath from 'svgpath';
import createBezierBuilder from 'adaptive-bezier-curve/function.js';

// See:
// https://github.com/mattdesl/adaptive-bezier-curve/blob/master/function.js#L12-L18
const DEFAULT_BEZIER_OPTIONS = {
  recursion: 8,
  pathEpsilon: 0.1,
};

const segmentBezier = createBezierBuilder(DEFAULT_BEZIER_OPTIONS);

export function getPathList(
  elements,
  { viewBox, dimensions, margins, rotation },
) {
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };

  const pathList = elements.reduce((result, element) => {
    const pathData = getPathData(element);

    if (pathData) {
      const instance = SVGPath.from(pathData)
        .unarc()
        .unshort()
        .abs()
        .iterate((segment, _index, currentX, currentY) => {
          // Reduce the command range from MCLHVQZ to MLCZ
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
        })
        .transform(element.transform);

      if (rotation !== 0) {
        instance.rotate(rotation, viewBox.width * 0.5, viewBox.height * 0.5);
      }

      const segmentList = [];

      let currentSegment = [];
      let closeSegment = null;

      instance.iterate((segment, _index, currentX, currentY) => {
        // Convert the commands into a list of points
        const command = segment[0];

        switch (command) {
          case 'M': {
            if (currentSegment.length > 0) {
              segmentList.push(currentSegment);
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
                [x3, y3],
              ).reduce((acc, current) => acc.concat(current), []),
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
        segmentList.push(currentSegment);
      }

      // Convert the flat array of numbers into point objects
      segmentList.forEach((segment) => {
        const path = [];
        for (let i = 0; i < segment.length; i += 2) {
          path.push({ x: segment[i], y: segment[i + 1] });
        }
        result.push(path);
      });
    }

    return result;
  }, []);

  // Calculate bounds
  pathList.forEach((path) => {
    path.forEach((position) => {
      bounds.minX = Math.min(position.x, bounds.minX);
      bounds.maxX = Math.max(position.x, bounds.maxX);
      bounds.minY = Math.min(position.y, bounds.minY);
      bounds.maxY = Math.max(position.y, bounds.maxY);
    });
  });

  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;

  const dimensionsWidth = dimensions.width - (margins.left + margins.right);
  const dimensionsHeight = dimensions.height - (margins.top + margins.bottom);

  const scale = Math.min(
    dimensionsWidth / boundsWidth,
    dimensionsHeight / boundsHeight,
  );

  const offsetX =
    -bounds.minX * scale + (dimensionsWidth - boundsWidth * scale) * 0.5;
  const offsetY =
    -bounds.minY * scale + (dimensionsHeight - boundsHeight * scale) * 0.5;

  pathList.forEach((path) => {
    path.forEach((position) => {
      position.x = position.x * scale + offsetX + margins.left;
      position.y = position.y * scale + offsetY + margins.top;
    });
  });

  return pathList;
}

export function randomizeStart(path, mergeDistance) {
  // Basically we need to see if this path is a complete loop
  const pathLength = path.length;
  const distance = distanceTo(
    path[0],
    path[1],
    path[pathLength - 2],
    path[pathLength - 1],
  );

  if (distance < mergeDistance) {
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

function getPathData(element) {
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

function distanceTo(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}
