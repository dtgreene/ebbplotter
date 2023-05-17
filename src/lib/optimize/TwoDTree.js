class TwoDNode {
  constructor(point, axis) {
    this.point = point;
    this.axis = axis;
    this.isActive = true;
    this.left = null;
    this.right = null;
  }
}

export class TwoDTree {
  constructor(points) {
    this.root = this._buildTree(points);
  }
  findNearestPoint = (point) => {
    let bestPoint = null;
    let minDistance = Infinity;

    function search(node) {
      if (node === null) {
        return;
      }

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

      search(side);

      if (Math.pow(diff, 2) < minDistance) {
        search(otherSide);
      }
    }

    search(this.root);

    return bestPoint;
  };
  disableNode = (point, equalFn) => {
    const node = this._findNode(this.root, point, equalFn);

    if (node === null) {
      return;
    }

    // disable the node
    node.isActive = false;
  };
  _findNode = (node, point, equalFn = defaultEqualFn) => {
    if (node === null) {
      return null;
    }

    if (node.isActive && equalFn(node.point, point)) {
      return node;
    }

    return (
      this._findNode(node.left, point, equalFn) ||
      this._findNode(node.right, point, equalFn)
    );
  };
  _buildTree = (points, depth = 0) => {
    if (points.length === 0) {
      return null;
    }

    const axis = depth % 2;
    const sortedPoints = points.slice().sort((a, b) => a[axis] - b[axis]);
    const medianIndex = Math.floor(sortedPoints.length * 0.5);
    const medianPoint = sortedPoints[medianIndex];

    const node = new TwoDNode(medianPoint, axis);

    node.left = this._buildTree(
      sortedPoints.slice(0, medianIndex),
      depth + 1,
      node
    );
    node.right = this._buildTree(
      sortedPoints.slice(medianIndex + 1),
      depth + 1,
      node
    );

    return node;
  };
}

function defaultEqualFn(a, b) {
  return a === b;
}
