/**
 * This file contains the functions for converting SVG arc curves
 * into a series of Bezier curves.
 */

const TAU = Math.PI * 2;

function mapToEllipse(
  { x, y }: { x: number; y: number },
  rx: number,
  ry: number,
  cosphi: number,
  sinphi: number,
  centerx: number,
  centery: number,
) {
  x *= rx;
  y *= ry;

  const xp = cosphi * x - sinphi * y;
  const yp = sinphi * x + cosphi * y;

  return {
    x: xp + centerx,
    y: yp + centery,
  };
}

/**
 * Approximate one unit arc segment with bézier curves.
 * 
 * Read more here: 
 * http://math.stackexchange.com/questions/873224
 */
function approxUnitArc(ang1: number, ang2: number) {
  // If 90 degree circular arc, use a constant
  // as derived from http://spencermortensen.com/articles/bezier-circle
  const a =
    ang2 === 1.5707963267948966
      ? 0.551915024494
      : ang2 === -1.5707963267948966
      ? -0.551915024494
      : (4 / 3) * Math.tan(ang2 / 4);

  const x1 = Math.cos(ang1);
  const y1 = Math.sin(ang1);
  const x2 = Math.cos(ang1 + ang2);
  const y2 = Math.sin(ang1 + ang2);

  return [
    {
      x: x1 - y1 * a,
      y: y1 + x1 * a,
    },
    {
      x: x2 + y2 * a,
      y: y2 - x2 * a,
    },
    {
      x: x2,
      y: y2,
    },
  ];
}

/**
 * Calculates an angle between two unit vectors.
 *
 * Since we measure angle between radii of circular arcs, we can use simplified
 * math (without length normalization).
 */
function vectorAngle(ux: number, uy: number, vx: number, vy: number) {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;

  let dot = ux * vx + uy * vy;

  // add this to work with arbitrary vectors:
  // dot /= Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);

  // rounding errors, e.g. -1.0000000000000002 can screw up this
  if (dot > 1) {
    dot = 1;
  } else if (dot < -1) {
    dot = -1;
  }

  return sign * Math.acos(dot);
}

function getArcCenter(
  px: number,
  py: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  largeArcFlag: number,
  sweepFlag: number,
  sinphi: number,
  cosphi: number,
  pxp: number,
  pyp: number,
) {
  const rxsq = Math.pow(rx, 2);
  const rysq = Math.pow(ry, 2);
  const pxpsq = Math.pow(pxp, 2);
  const pypsq = Math.pow(pyp, 2);

  let radicant = rxsq * rysq - rxsq * pypsq - rysq * pxpsq;

  if (radicant < 0) {
    radicant = 0;
  }

  radicant /= rxsq * pypsq + rysq * pxpsq;
  radicant = Math.sqrt(radicant) * (largeArcFlag === sweepFlag ? -1 : 1);

  const centerxp = ((radicant * rx) / ry) * pyp;
  const centeryp = ((radicant * -ry) / rx) * pxp;

  const centerx = cosphi * centerxp - sinphi * centeryp + (px + cx) / 2;
  const centery = sinphi * centerxp + cosphi * centeryp + (py + cy) / 2;

  const vx1 = (pxp - centerxp) / rx;
  const vy1 = (pyp - centeryp) / ry;
  const vx2 = (-pxp - centerxp) / rx;
  const vy2 = (-pyp - centeryp) / ry;

  let ang1 = vectorAngle(1, 0, vx1, vy1);
  let ang2 = vectorAngle(vx1, vy1, vx2, vy2);

  if (sweepFlag === 0 && ang2 > 0) {
    ang2 -= TAU;
  }

  if (sweepFlag === 1 && ang2 < 0) {
    ang2 += TAU;
  }

  return [centerx, centery, ang1, ang2];
}

export function arcToBezier(
  px: number,
  py: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  xAxisRotation: number,
  largeArcFlag: 0 | 1,
  sweepFlag: 0 | 1,
) {
  const curves = [];

  if (rx === 0 || ry === 0) {
    return [];
  }

  const sinphi = Math.sin((xAxisRotation * TAU) / 360);
  const cosphi = Math.cos((xAxisRotation * TAU) / 360);

  const pxp = (cosphi * (px - cx)) / 2 + (sinphi * (py - cy)) / 2;
  const pyp = (-sinphi * (px - cx)) / 2 + (cosphi * (py - cy)) / 2;

  if (pxp === 0 && pyp === 0) {
    return [];
  }

  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const lambda =
    Math.pow(pxp, 2) / Math.pow(rx, 2) + Math.pow(pyp, 2) / Math.pow(ry, 2);

  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  let [centerx, centery, ang1, ang2] = getArcCenter(
    px,
    py,
    cx,
    cy,
    rx,
    ry,
    largeArcFlag,
    sweepFlag,
    sinphi,
    cosphi,
    pxp,
    pyp,
  );

  // If 'ang2' == 90.0000000001, then `ratio` will evaluate to
  // 1.0000000001. This causes `segments` to be greater than one, which is an
  // unecessary split, and adds extra points to the bezier curve. To alleviate
  // this issue, we round to 1.0 when the ratio is close to 1.0.
  let ratio = Math.abs(ang2) / (TAU / 4);
  if (Math.abs(1.0 - ratio) < 0.0000001) {
    ratio = 1.0;
  }

  const segments = Math.max(Math.ceil(ratio), 1);

  ang2 /= segments;

  for (let i = 0; i < segments; i++) {
    curves.push(approxUnitArc(ang1, ang2));
    ang1 += ang2;
  }

  return curves.map((curve) => {
    const { x: x1, y: y1 } = mapToEllipse(
      curve[0],
      rx,
      ry,
      cosphi,
      sinphi,
      centerx,
      centery,
    );
    const { x: x2, y: y2 } = mapToEllipse(
      curve[1],
      rx,
      ry,
      cosphi,
      sinphi,
      centerx,
      centery,
    );
    const { x, y } = mapToEllipse(
      curve[2],
      rx,
      ry,
      cosphi,
      sinphi,
      centerx,
      centery,
    );

    return [x1, y1, x2, y2, x, y];
  });
}
