import { distanceTo } from '../../utils.js';

export function randomizeStart(segments) {
  return segments.map((points) => {
    // Basically we want to see if this segment is a complete loop.
    // I.e. does the path end in the same place where it starts

    // Ideally, the distance would equal zero but just in case there
    // are some floating point errors, we compare the distance to a
    // very small number.
    const pointsLength = points.length;
    if (
      distanceTo(
        points[0],
        points[1],
        points[pointsLength - 1],
        points[pointsLength - 2]
      ) < 0.01
    ) {
      const startIndex = Math.floor(Math.random() * pointsLength);

      // Pick a new starting index and stitch the path back together
      return points.slice(startIndex).concat(points.slice(0, startIndex));
    }

    return points;
  });
}
