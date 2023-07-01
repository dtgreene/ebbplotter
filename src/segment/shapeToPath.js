export const shapeToPath = {
  rect: getRect,
  circle: getCircle,
  ellipse: getEllipse,
  line: getLine,
  polygon: getPolygon,
  polyline: getPolyline,
};

function getNumberProps(shape, props) {
  const result = {};

  props.forEach((prop) => {
    const value = shape[prop];

    if (value) {
      result[prop] = Number(value);
    } else {
      result[prop] = 0;
    }
  });

  return result;
}

function renderPath(input) {
  return input
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      } else {
        return value.join(' ');
      }
    })
    .join(' ');
}

function getRect(shape) {
  const {
    x,
    y,
    width,
    height,
    rx: attrRX,
    ry: attrRY,
  } = getNumberProps(shape, ['x', 'y', 'width', 'height', 'rx', 'ry']);

  if (attrRX || attrRY) {
    let rx = !attrRX ? attrRY : attrRX;
    let ry = !attrRY ? attrRX : attrRY;

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

function getCircle(shape) {
  const { cx, cy, r } = getNumberProps(shape, ['cx', 'cy', 'r']);

  return renderPath([
    'M',
    [cx - r, cy],
    'a',
    [r, r, 0, 1, 0, 2 * r, 0],
    'a',
    [r, r, 0, 1, 0, -2 * r, 0],
  ]);
}

function getEllipse(shape) {
  const { cx, cy, rx, ry } = getNumberProps(shape, ['cx', 'cy', 'rx', 'ry']);

  return renderPath([
    'M',
    [cx - rx, cy],
    'a',
    [rx, ry, 0, 1, 0, 2 * rx, 0],
    'a',
    [rx, ry, 0, 1, 0, -2 * rx, 0],
  ]);
}

function getLine(shape) {
  const { x1, x2, y1, y2 } = getNumberProps(shape, ['x1', 'x2', 'y1', 'y2']);
  return renderPath(['M', [x1, y1], 'L', [x2, y2]]);
}

function getPolygon(shape) {
  return getPolyPath(shape).concat('Z');
}

function getPolyline(shape) {
  return getPolyPath(shape);
}

function getPolyPath(shape) {
  const { points = '' } = shape;
  const data = points.trim().split(/[ ,]+/);

  const path = [];
  for (let i = 0; i < data.length; i += 2) {
    path.push(i === 0 ? 'M' : 'L', [Number(data[i]), Number(data[i + 1])]);
  }

  return renderPath(path);
}
