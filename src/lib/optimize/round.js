// rounds out numbers to a fixed precision
export function round(segments, precision = 4) {
  const p = 10 ** precision;
  return segments.map((points) =>
    points.map((value) => Math.round(value * p) / p)
  );
}
