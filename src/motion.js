import config from './config.ebb.js';

const EPSILON = 1e-9;
const { servo, speeds } = config;

// const PLOT_ACTION_TYPE = {
//   NONE: 0,
//   MOVE: 1,
//   PEN_UP: 2,
//   PEN_DOWN: 3,
// };

// class PlotAction {
//   type = PLOT_ACTION_TYPE.NONE;
//   constructor(type) {
//     this.type = type;
//   }
// }

// class Move extends PlotAction {
//   constructor(segment) {
//     super(PLOT_ACTION_TYPE.MOVE);
//   }
// }

// class PenUp extends PlotAction {
//   constructor() {
//     super(PLOT_ACTION_TYPE.PEN_UP);
//   }
// }

// class PenDown extends PlotAction {
//   constructor() {
//     super(PLOT_ACTION_TYPE.PEN_DOWN);
//   }
// }

class EBBCommand {
  constructor(command, duration) {
    this.command = command;
    this.duration = duration;
  }
}

class Vector2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  length = () => {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  };
  normal = () => {
    return this.multiply(1 / this.length());
  };
  multiply = (value) => {
    return new Vector2(this.x * value, this.y * value);
  };
  subtract = (vector) => {
    return new Vector2(this.x - vector.x, this.y - vector.y);
  };
  dot = (vector) => {
    return this.x * vector.x + this.y * vector.y;
  };
}

class MotionSegment {
  maxEntrySpeed = 0;
  constructor(vector1, vector2) {
    this.vector1 = vector1;
    this.vector2 = vector2;
  }
  length = () => {
    return this.vector2.subtract(this.vector1).length();
  };
  direction = () => {
    return this.vector2.subtract(this.vector1).normal();
  };
}

function getJunctionSpeed(segment1, segment2, maxSpeed) {
  const { cornerFactor, acceleration } = speeds;

  // https://onehossshay.wordpress.com/2011/09/24/improving_grbl_cornering_algorithm/
  const theta = -segment1.direction().dot(segment2.direction());
  if (Math.abs(theta - 1) < EPSILON) return 0;

  const radius = Math.sqrt((1 - theta) / 2);
  if (Math.abs(radius - 1) < EPSILON) return maxSpeed;

  const speed = Math.sqrt(
    (acceleration * cornerFactor * radius) / (1 - radius)
  );

  return Math.min(speed, maxSpeed);
}

export function createMotionPlan(segments, startPosition = { x: 0, y: 0 }) {
  const penDuration = servo.duration;
  const downSpeed = speeds.down;
  const acceleration = speeds.acceleration;

  let position = { ...startPosition };
  // let motions = [];
  let commands = [];

  segments.forEach((segment) => {
    if (segment.length < 2) {
      throw new Error('Invalid segment length; must be greater than 2');
    }
    if (segment.length % 2 !== 0) {
      throw new Error('Invalid segment length; must be even');
    }

    let motionSegments = [];
    let currentSpeed = 0;
    let previousMotionSegment = null;

    motionSegments.push(
      new MotionSegment(
        new Vector2(position.x, position.y),
        new Vector2(segment[0], segment[1])
      )
    );

    for (let i = 0; i < segment.length - 2; i += 2) {
      const x = segment[i];
      const y = segment[i + 1];
      const nextX = segment[i + 2];
      const nextY = segment[i + 3];

      const vector1 = new Vector2(x, y);
      const vector2 = new Vector2(nextX, nextY);

      const motionSegment = new MotionSegment(vector1, vector2);

      if (previousMotionSegment) {
        motionSegment.maxEntrySpeed = getJunctionSpeed(
          previousMotionSegment,
          motionSegment,
          downSpeed
        );
      }

      motionSegments.push(motionSegment);
      previousMotionSegment = motionSegment;
    }

    // motions.push(/* Move to end of first segment */)
    // motions.push(/* Pen down */)
    commands.push(new EBBCommand('SP,1', penDuration));

    for (let i = 0; i < motionSegments.length; i++) {
      let targetSpeed = 0;

      const currentSegment = motionSegments[i];
      const nextSegment = motionSegments[i + 1];

      const exitSpeed = nextSegment ? nextSegment.maxEntrySpeed : 0;
      const speedDelta = exitSpeed - currentSpeed;

      const length = currentSegment.length();

      
      // motions.push(/* Move to end of segment */)
    }

    // motions.push(/* Pen up */)
    commands.push(new EBBCommand('SP,0', penDuration));

    // const lastSegment = motionSegments[motionSegments.length - 1];
    // position.x = lastSegment.vector2.x;
    // position.y = lastSegment.vector2.y;
  });
}
