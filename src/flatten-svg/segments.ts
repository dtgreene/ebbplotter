import { arcToBezier } from './arc';
import { getNumberAttrs } from './utils';

export type PathSegment = {
  command: string;
  values: number[];
};

const commandLengths = {
  V: 1,
  H: 1,
  M: 2,
  L: 2,
  T: 2,
  S: 4,
  Q: 4,
  C: 6,
  A: 7,
  Z: 0,
};

const pathExp = /([astvzqmhlc])([^astvzqmhlc]*)/gi;
const numberExp = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi;

/**
 * Convert a shape element into a list of absolute path segments consisting of only
 * *M, L, C, and Z* commands
 * */
export function shapeToSegments(element: SVGSVGElement): PathSegment[] {
  const type = element.nodeName.toLowerCase();

  switch (type) {
    case 'rect': {
      return getRect(element);
    }
    case 'circle': {
      return getCircle(element);
    }
    case 'ellipse': {
      return getEllipse(element);
    }
    case 'path': {
      return getPath(element);
    }
    case 'line': {
      return getLine(element);
    }
    case 'polyline': {
      return getPolyline(element);
    }
    case 'polygon': {
      return getPolygon(element);
    }
    default: {
      throw new Error(`Unsupported element type: ${type}`);
    }
  }
}

/**
 * Given a list of path segments with both relative and absolute commands, convert
 * each command to its absolute version.
 */
function absPath(segments: PathSegment[]): PathSegment[] {
  const result: PathSegment[] = [];

  let currentX = 0;
  let currentY = 0;

  let subpathX = 0;
  let subpathY = 0;

  segments.forEach(({ command, values }) => {
    switch (command) {
      case 'M': {
        const [x, y] = values;

        subpathX = x;
        subpathY = y;

        currentX = x;
        currentY = y;

        result.push({ command, values });
        break;
      }
      case 'm': {
        const x = currentX + values[0];
        const y = currentY + values[1];

        subpathX = x;
        subpathY = y;

        currentX = x;
        currentY = y;

        result.push({ command: 'M', values: [x, y] });
        break;
      }
      case 'L': {
        const [x, y] = values;

        currentX = x;
        currentY = y;

        result.push({ command: 'L', values });
        break;
      }
      case 'l': {
        const x = currentX + values[0];
        const y = currentY + values[1];

        currentX = x;
        currentY = y;

        result.push({ command: 'L', values: [x, y] });
        break;
      }
      case 'C': {
        const x = values[4];
        const y = values[5];

        currentX = x;
        currentY = y;

        result.push({ command: 'C', values });
        break;
      }
      case 'c': {
        const x1 = currentX + values[0];
        const y1 = currentY + values[1];
        const x2 = currentX + values[2];
        const y2 = currentY + values[3];
        const x = currentX + values[4];
        const y = currentY + values[5];

        currentX = x;
        currentY = y;

        result.push({ command: 'C', values: [x1, y1, x2, y2, x, y] });
        break;
      }
      case 'Q': {
        const x = values[2];
        const y = values[3];

        currentX = x;
        currentY = y;

        result.push({ command: 'Q', values });
        break;
      }
      case 'q': {
        const x1 = currentX + values[0];
        const y1 = currentY + values[1];
        const x = currentX + values[2];
        const y = currentY + values[3];

        currentX = x;
        currentY = y;

        result.push({ command: 'Q', values: [x1, y1, x, y] });
        break;
      }
      case 'A': {
        const x = values[5];
        const y = values[6];

        currentX = x;
        currentY = y;

        result.push({ command: 'A', values });
        break;
      }
      case 'a': {
        const x = currentX + values[5];
        const y = currentY + values[6];

        currentX = x;
        currentY = y;

        result.push({
          command: 'A',
          values: [values[0], values[1], values[2], values[3], values[4], x, y],
        });
        break;
      }
      case 'H': {
        const x = values[0];
        currentX = x;
        result.push({ command: 'H', values });
        break;
      }
      case 'h': {
        const x = currentX + values[0];
        currentX = x;
        result.push({ command: 'H', values: [x] });
        break;
      }
      case 'V': {
        const y = values[0];
        currentY = y;
        result.push({ command: 'V', values });
        break;
      }
      case 'v': {
        const y = currentY + values[0];
        currentY = y;
        result.push({ command: 'V', values: [y] });
        break;
      }
      case 'S': {
        const x = values[2];
        const y = values[3];

        currentX = x;
        currentY = y;

        result.push({ command: 'S', values });
        break;
      }
      case 's': {
        const x2 = currentX + values[0];
        const y2 = currentY + values[1];
        const x = currentX + values[2];
        const y = currentY + values[3];

        currentX = x;
        currentY = y;

        result.push({ command: 'S', values: [x2, y2, x, y] });
        break;
      }
      case 'T': {
        const x = values[0];
        const y = values[1];

        currentX = x;
        currentY = y;

        result.push({ command: 'T', values });
        break;
      }
      case 't': {
        const x = currentX + values[0];
        const y = currentY + values[1];

        currentX = x;
        currentY = y;

        result.push({ command: 'T', values: [x, y] });
        break;
      }
      case 'z':
      case 'Z': {
        currentX = subpathX;
        currentY = subpathY;

        result.push({ command: 'Z', values: [] });
        break;
      }
      default: {
        // this is already checked when parsing the SVG shapes
        // just a backup
        throw new Error(`Encountered unknown command: ${command}`);
      }
    }
  });

  return result;
}

/**
 * Given a list of path segments with absolute commands, reduce each command
 * to one of the following: *M, L, C, Z*. The possible input commands are: *M, C, L, H,
 * V, S, T, Q, A, Z*.
 *
 * Unknown or invalid input commands will be ignored.
 */
function reducePath(segments: PathSegment[]): PathSegment[] {
  const result: PathSegment[] = [];

  let lastCommand = '';

  let lastControlX = 0;
  let lastControlY = 0;

  let currentX = 0;
  let currentY = 0;

  let subpathX = 0;
  let subpathY = 0;

  segments.forEach(({ command, values }) => {
    switch (command) {
      case 'M': {
        const [x, y] = values;

        subpathX = x;
        subpathY = y;

        currentX = x;
        currentY = y;

        result.push({ command: 'M', values });
        break;
      }
      case 'C': {
        const x2 = values[2];
        const y2 = values[3];
        const x = values[4];
        const y = values[5];

        lastControlX = x2;
        lastControlY = y2;

        currentX = x;
        currentY = y;

        result.push({ command: 'C', values });
        break;
      }
      case 'L': {
        const [x, y] = values;

        currentX = x;
        currentY = y;

        result.push({ command: 'L', values });
        break;
      }
      case 'H': {
        const x = values[0];
        currentX = x;
        result.push({ command: 'L', values: [x, currentY] });
        break;
      }
      case 'V': {
        const y = values[0];
        currentY = y;
        result.push({ command: 'L', values: [currentX, y] });
        break;
      }
      case 'S': {
        const [x2, y2, x, y] = values;

        let cx1 = 0;
        let cy1 = 0;

        if (lastCommand === 'C' || lastCommand === 'S') {
          cx1 = currentX + (currentX - lastControlX);
          cy1 = currentY + (currentY - lastControlY);
        } else {
          cx1 = currentX;
          cy1 = currentY;
        }

        lastControlX = x2;
        lastControlY = y2;

        currentX = x;
        currentY = y;

        result.push({ command: 'C', values: [cx1, cy1, x2, y2, x, y] });
        break;
      }
      case 'T': {
        const [x, y] = values;

        let x1 = 0;
        let y1 = 0;

        if (lastCommand === 'Q' || lastCommand === 'T') {
          x1 = currentX + (currentX - lastControlX);
          y1 = currentY + (currentY - lastControlY);
        } else {
          x1 = currentX;
          y1 = currentY;
        }

        const cx1 = currentX + (2 * (x1 - currentX)) / 3;
        const cy1 = currentY + (2 * (y1 - currentY)) / 3;
        const cx2 = x + (2 * (x1 - x)) / 3;
        const cy2 = y + (2 * (y1 - y)) / 3;

        lastControlX = x1;
        lastControlY = y1;

        currentX = x;
        currentY = y;

        result.push({ command: 'C', values: [cx1, cy1, cx2, cy2, x, y] });
        break;
      }
      case 'Q': {
        const [x1, y1, x, y] = values;

        const cx1 = currentX + (2 * (x1 - currentX)) / 3;
        const cy1 = currentY + (2 * (y1 - currentY)) / 3;
        const cx2 = x + (2 * (x1 - x)) / 3;
        const cy2 = y + (2 * (y1 - y)) / 3;

        lastControlX = x1;
        lastControlY = y1;

        currentX = x;
        currentY = y;

        result.push({ command: 'C', values: [cx1, cy1, cx2, cy2, x, y] });
        break;
      }
      case 'A': {
        const r1 = Math.abs(values[0]);
        const r2 = Math.abs(values[1]);
        const [_r1, _r2, angle, largeArcFlag, sweepFlag, x, y] = values;

        if (r1 === 0 || r2 === 0) {
          result.push({
            command: 'C',
            values: [currentX, currentY, x, y, x, y],
          });

          currentX = x;
          currentY = y;
        } else {
          if (currentX !== x || currentY !== y) {
            const curves = arcToBezier(
              currentX,
              currentY,
              x,
              y,
              r1,
              r2,
              angle,
              largeArcFlag as 0 | 1,
              sweepFlag as 0 | 1,
            );

            curves.forEach((curve) => {
              result.push({ command: 'C', values: curve });
            });

            currentX = x;
            currentY = y;
          }
        }
        break;
      }
      case 'Z': {
        currentX = subpathX;
        currentY = subpathY;

        result.push({ command, values });
        break;
      }
    }

    lastCommand = command;
  });

  return result;
}

function getRect(element: SVGSVGElement): PathSegment[] {
  const {
    x,
    y,
    width,
    height,
    rx: roundX,
    ry: roundY,
  } = getNumberAttrs(element, ['x', 'y', 'width', 'height', 'rx', 'ry']);

  const rx = Math.min(
    element.hasAttribute('rx') ? roundX : roundY,
    width * 0.5,
  );
  const ry = Math.min(
    element.hasAttribute('ry') ? roundY : roundX,
    height * 0.5,
  );

  let segments: PathSegment[] = [];

  if (rx || ry) {
    segments = [
      { command: 'M', values: [x + rx, y] },
      { command: 'H', values: [x + width - rx] },
      { command: 'A', values: [rx, ry, 0, 0, 1, x + width, y + ry] },
      { command: 'V', values: [y + height - ry] },
      { command: 'A', values: [rx, ry, 0, 0, 1, x + width - rx, y + height] },
      { command: 'H', values: [x + rx] },
      { command: 'A', values: [rx, ry, 0, 0, 1, x, y + height - ry] },
      { command: 'V', values: [y + ry] },
      { command: 'A', values: [rx, ry, 0, 0, 1, x + rx, y] },
      { command: 'Z', values: [] },
    ];
  } else {
    segments = [
      { command: 'M', values: [x, y] },
      { command: 'H', values: [x + width] },
      { command: 'V', values: [y + height] },
      { command: 'H', values: [x] },
      { command: 'V', values: [y] },
      { command: 'Z', values: [] },
    ];
  }

  return reducePath(segments);
}

function getCircle(element: SVGSVGElement): PathSegment[] {
  const { cx, cy, r } = getNumberAttrs(element, ['cx', 'cy', 'r']);

  const segments: PathSegment[] = [
    { command: 'M', values: [cx + r, cy] },
    { command: 'A', values: [r, r, 0, 0, 1, cx, cy + r] },
    { command: 'A', values: [r, r, 0, 0, 1, cx - r, cy] },
    { command: 'A', values: [r, r, 0, 0, 1, cx, cy - r] },
    { command: 'A', values: [r, r, 0, 0, 1, cx + r, cy] },
    { command: 'Z', values: [] },
  ];

  return reducePath(segments);
}

function getEllipse(element: SVGSVGElement): PathSegment[] {
  const { cx, cy, rx, ry } = getNumberAttrs(element, ['cx', 'cy', 'rx', 'ry']);

  const segments: PathSegment[] = [
    { command: 'M', values: [cx + rx, cy] },
    { command: 'A', values: [rx, ry, 0, 0, 1, cx, cy + ry] },
    { command: 'A', values: [rx, ry, 0, 0, 1, cx - rx, cy] },
    { command: 'A', values: [rx, ry, 0, 0, 1, cx, cy - ry] },
    { command: 'A', values: [rx, ry, 0, 0, 1, cx + rx, cy] },
    { command: 'Z', values: [] },
  ];

  return reducePath(segments);
}

function getPath(element: SVGSVGElement): PathSegment[] {
  let segments: PathSegment[] = [];

  const data = element.getAttribute('d');

  if (data !== null) {
    const matches = Array.from(data.matchAll(pathExp));

    matches.forEach((match) => {
      const [_, capture1, capture2] = match;

      let command = capture1;
      let commandUpper = command.toUpperCase();

      if (match.index === 0 && commandUpper !== 'M') {
        // the first character must be a move command
        throw new Error(
          `Path data must start with a move command but got: ${command}`,
        );
      }

      // verify command is known
      if (!Object.keys(commandLengths).includes(commandUpper)) {
        throw new Error(`Got unknown or invalid command: ${command}`);
      }

      const numbers = capture2.match(numberExp);
      const values = numbers ? numbers.map((value) => Number(value)) : [];

      // overloaded move command
      if (commandUpper === 'M' && values.length > 2) {
        segments.push({
          command,
          values: values.splice(0, 2),
        });

        const isUpper = command === commandUpper;
        command = isUpper ? 'L' : 'l';
        commandUpper = command.toUpperCase();
      }

      const commandKey = commandUpper as keyof typeof commandLengths;
      const length = commandLengths[commandKey];

      if (values.length < length) {
        throw new Error(
          `Malformed path data; expected ${length} values but found ${values.length}`,
        );
      }

      if (commandUpper === 'Z') {
        // for close path commands, use absolute
        segments.push({ command: 'Z', values: [] });
      } else {
        segments.push({ command, values });
      }
    });

    segments = absPath(segments);
  }

  return reducePath(segments);
}

function getLine(element: SVGSVGElement): PathSegment[] {
  const { x1, x2, y1, y2 } = getNumberAttrs(element, ['x1', 'x2', 'y1', 'y2']);
  return [
    { command: 'M', values: [x1, y1] },
    { command: 'L', values: [x2, y2] },
  ];
}

function getPolygon(element: SVGSVGElement): PathSegment[] {
  const segments: PathSegment[] = [];
  const points = element.getAttribute('points');

  if (points) {
    const data = points.split(/[ ,]+/);

    for (let i = 0; i < data.length; i += 2) {
      segments.push({
        command: i === 0 ? 'M' : 'L',
        values: [Number(data[i]), Number(data[i + 1])],
      });
    }
  }

  // close the path for polygons
  segments.push({ command: 'Z', values: [] });

  return segments;
}

function getPolyline(element: SVGSVGElement): PathSegment[] {
  const segments: PathSegment[] = [];
  const points = element.getAttribute('points');

  if (points) {
    const data = points.split(/[ ,]+/);

    for (let i = 0; i < data.length; i += 2) {
      segments.push({
        command: i === 0 ? 'M' : 'L',
        values: [Number(data[i]), Number(data[i + 1])],
      });
    }
  }

  return segments;
}
