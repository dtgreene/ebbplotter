import { TwoDTree } from './TwoDTree.js';

export function sort(segments) {
  const result = [];

  // create an array containing both the start and end points for each segment
  // the format is [x1, y1, x2, y2, index, reversed]
  const data = segments.reduce((acc, current, index) => {
    const endIndex = current.length - 2;

    // the path start
    const x1 = current[0];
    const y1 = current[1];

    // the path end
    const x2 = current[endIndex];
    const y2 = current[endIndex + 1];

    let hasReverse = false;

    // if the path end is different than the path start
    // otherwise, reversing the path makes no difference
    if (x1 !== x2 || y1 !== y2) {
      // add the reverse path
      acc.push([x2, y2, index, true, true]);
      hasReverse = true;
    }

    // add the forward path
    acc.push([x1, y1, index, false, hasReverse]);

    return acc;
  }, []);

  // bulk insert the segment data
  const tree = new TwoDTree(data);

  // start at the origin
  let currentPoint = [0, 0];

  while (result.length < segments.length) {
    // find the nearest node
    const nearest = tree.findNearestPoint(currentPoint);

    if (!nearest) {
      console.error('There was an problem sorting');
      return [];
    }

    const [_x, _y, pathIndex, isReversed, hasReverse] = nearest;

    // look up the original path
    const originalPath = segments[pathIndex];
    // reverse the path if this node is reversed
    const path = isReversed ? reversePath(originalPath) : originalPath;
    // the end of the path
    const endIndex = path.length - 2;

    // add the path to the result
    result.push(path);

    // update the current point
    currentPoint[0] = path[endIndex];
    currentPoint[1] = path[endIndex + 1];

    // remove the nearest node
    tree.disableNode(nearest, compareNodes);

    if (hasReverse) {
      // attempt to remove the reversed node
      tree.disableNode([currentPoint[0], currentPoint[1], pathIndex], compareNodes);
    }
  }

  return result;
}

function reversePath(path) {
  const result = [];

  for (let i = path.length - 1; i >= 0; i -= 2) {
    result.push(path[i - 1], path[i]);
  }

  return result;
}

function compareNodes(a, b) {
  return a[2] === b[2];
}
