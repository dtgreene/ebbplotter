class TwoDNode {
  constructor(point, axis, left, right) {
    this.point = point;
    this.axis = axis;
    this.isActive = true;
    this.left = left;
    this.right = right;
  }
}

function disableNode(tree, point) {
  const node = getNode(tree, point);

  if (node === null) {
    return;
  }

  // Disable the node
  node.isActive = false;
}

function getNode(node, point) {
  if (node === null) {
    return null;
  }

  // The nodes are equal if they both reference the same index
  const isEqual = node.point[2] === point[2];

  if (node.isActive && isEqual) {
    return node;
  }

  return getNode(node.left, point) || getNode(node.right, point);
}

function getNearestNode(root, point) {
  let bestPoint = null;
  let minDistance = Infinity;
  let nodeStack = [root];

  while (nodeStack.length > 0) {
    const node = nodeStack.pop();
    const distance =
      Math.pow(point[0] - node.point[0], 2) +
      Math.pow(point[1] - node.point[1], 2);

    if (node.isActive && distance < minDistance) {
      minDistance = distance;
      bestPoint = node.point;
    }

    const axis = node.axis;
    const diff = point[axis] - node.point[axis];

    let side;
    let otherSide;

    if (diff < 0) {
      side = node.left;
      otherSide = node.right;
    } else {
      side = node.right;
      otherSide = node.left;
    }

    if (side) {
      nodeStack.push(side);
    }

    if (otherSide && diff ** 2 < minDistance) {
      nodeStack.push(otherSide);
    }
  }

  return bestPoint;
}

function buildTree(points, depth = 0) {
  if (points.length === 0) {
    return null;
  }

  const axis = depth % 2;
  const sortedPoints = points.slice();
  sortedPoints.sort((a, b) => a[axis] - b[axis]);

  const medianIndex = Math.floor(sortedPoints.length * 0.5);
  const medianPoint = sortedPoints[medianIndex];
  const nextDepth = depth + 1;

  return new TwoDNode(
    medianPoint,
    axis,
    buildTree(sortedPoints.slice(0, medianIndex), nextDepth),
    buildTree(sortedPoints.slice(medianIndex + 1), nextDepth),
  );
}

export function sort(pathList) {
  const result = [];

  // Create an array containing both the start and end points for each segment
  // in the format [x1, y1, x2, y2, index, reversed]
  const data = pathList.reduce((acc, path, index) => {
    const endIndex = path.length - 2;

    // The path start
    const x1 = path[0];
    const y1 = path[1];

    // The path end
    const x2 = path[endIndex];
    const y2 = path[endIndex + 1];

    let hasReverse = false;

    // If the path end is different than the path start otherwise, reversing the
    // path makes no difference
    if (x1 !== x2 || y1 !== y2) {
      // Add the reverse path
      acc.push([x2, y2, index, true, true]);
      hasReverse = true;
    }

    // Add the forward path
    acc.push([x1, y1, index, false, hasReverse]);

    return acc;
  }, []);

  // bulk insert the segment data
  const tree = buildTree(data);

  // start at the origin
  let currentPoint = [0, 0];

  while (result.length < pathList.length) {
    // Find the nearest node
    const nearest = getNearestNode(tree, currentPoint);
    const [_x, _y, pathIndex, isReversed, hasReverse] = nearest;

    // Look up the original path
    const originalPath = pathList[pathIndex];
    // Reverse the path if this node is reversed
    const path = isReversed ? reversePath(originalPath) : originalPath;
    // The end of the path
    const endIndex = path.length - 2;

    // Add the path to the result
    result.push(path);

    // Update the current point
    currentPoint[0] = path[endIndex];
    currentPoint[1] = path[endIndex + 1];

    // Remove the nearest node
    disableNode(nearest);

    if (hasReverse) {
      // Attempt to remove the reversed node
      disableNode([currentPoint[0], currentPoint[1], pathIndex]);
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
