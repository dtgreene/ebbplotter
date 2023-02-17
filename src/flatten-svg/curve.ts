type Curve = [number, number, number, number, number, number, number, number];

/**
 * Determines if a curve is sufficiently flat, meaning it appears as a
 * straight line and has curve-time that is enough linear, as specified by
 * the given `flatness` parameter.
 *
 * Read more here:
 * https://github.com/paperjs/paper.js/blob/a61e83edf2ed1870bd41bad135f4f6fc85b0f628/src/path/Curve.js#L806
 */
function isFlatEnough(v: Curve, flatness: number): boolean {
  // Thanks to Kaspar Fischer and Roger Willcocks for the following:
  // http://hcklbrrfnn.files.wordpress.com/2012/08/bez.pdf
  const [x0, y0, x1, y1, x2, y2, x3, y3] = v;
  const ux = 3 * x1 - 2 * x0 - x3;
  const uy = 3 * y1 - 2 * y0 - y3;
  const vx = 3 * x2 - 2 * x3 - x0;
  const vy = 3 * y2 - 2 * y3 - y0;
  return (
    Math.max(ux * ux, vx * vx) + Math.max(uy * uy, vy * vy) <=
    16 * flatness * flatness
  );
}

/**
 * Subdivides a curve
 *
 * Read more here:
 * https://github.com/paperjs/paper.js/blob/a61e83edf2ed1870bd41bad135f4f6fc85b0f628/src/path/Curve.js#L806
 */
function subdivide(v: Curve, t: number = 0.5): [Curve, Curve] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = v;

  // Triangle computation, with loops unrolled.
  const u = 1 - t;

  // Interpolate from 4 to 3 points
  const x4 = u * x0 + t * x1;
  const y4 = u * y0 + t * y1;
  const x5 = u * x1 + t * x2;
  const y5 = u * y1 + t * y2;
  const x6 = u * x2 + t * x3;
  const y6 = u * y2 + t * y3;

  // Interpolate from 3 to 2 points
  const x7 = u * x4 + t * x5;
  const y7 = u * y4 + t * y5;
  const x8 = u * x5 + t * x6;
  const y8 = u * y5 + t * y6;

  // Interpolate from 2 points to 1 point
  const x9 = u * x7 + t * x8;
  const y9 = u * y7 + t * y8;

  // We now have all the values we need to build the sub-curves:
  return [
    [x0, y0, x4, y4, x7, y7, x9, y9], // left
    [x9, y9, x8, y8, x6, y6, x3, y3], // right
  ];
}

/**
 * Returns the angle between two vectors. The angle is directional and
 * signed, giving information about the rotational direction.
 *
 * Read more:
 * https://github.com/paperjs/paper.js/blob/77188ce229a7f275a34ec656d03a3e52058fc683/src/basic/Point.js#L422
 */
// function getDirectedAngle(
//   ux: number,
//   uy: number,
//   vx: number,
//   vy: number,
// ): number {
//   return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
// }

export function flattenCurve(v: Curve, flatness: number, maxRecursion = 32) {
  const minSpan = 1 / maxRecursion;
  const parts: Curve[] = [];

  function computeParts(curve: Curve, t1: number, t2: number) {
    if (
      t2 - t1 > minSpan &&
      !isFlatEnough(curve, flatness) /* && !isStraight(curve) */
    ) {
      const halves = subdivide(curve, 0.5);
      const tMid = (t1 + t2) / 2;
      computeParts(halves[0], t1, tMid);
      computeParts(halves[1], tMid, t2);
    } else {
      const dx = curve[6] - curve[0];
      const dy = curve[7] - curve[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        parts.push(curve);
      }
    }
  }

  computeParts(v, 0, 1);

  return parts;
}
