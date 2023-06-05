import { PEN_RADIUS } from '../../constants.js';
import { distanceTo } from '../../utils.js';

export function randomizeStart(segments) {
  return segments.map((points) => {
    // Basically we want to see if this segment is a complete loop.
    // I.e. does the path end in the same place where it starts

    // Ideally, the distance would equal zero but just in case there
    // are some floating point errors, we compare the distance to a
    // very small number.
    const pointsLength = points.length;
    const distance = distanceTo(
      points[0],
      points[1],
      points[pointsLength - 2],
      points[pointsLength - 1]
    );

    if (distance < PEN_RADIUS) {
      let startIndex = Math.floor(Math.random() * pointsLength);

      // The start index must be even
      if (startIndex % 2 !== 0) {
        startIndex++;
      }

      if (startIndex > 1 && startIndex < pointsLength - 2) {
        const startingPoint = points.slice(startIndex, startIndex + 2);

        // Recreate the path starting from a new point. We also remove the
        // current ending point and replace it with the new starting point.
        return points
          .slice(startIndex)
          .concat(points.slice(2, startIndex))
          .concat(startingPoint);
      }
    }

    return points;
  });
}
