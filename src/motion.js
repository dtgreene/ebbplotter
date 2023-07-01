import config from './config.ebb.js';

export function moveTo(x, y, velocity) {}
export function moveToAccelerated(x, y, initialVelocity, finalVelocity) {}

function createMotionPlan(segments, maxSpeed, acceleration) {}

// const ACTION_TYPE = {
//   NONE: 0,
//   MOVE: 1,
//   PEN_UP: 2,
//   PEN_DOWN: 3,
// };

// class BotAction {
//   type = ACTION_TYPE.NONE;
//   constructor(type) {
//     this.type = type;
//   }
// }

// class Movement extends BotAction {
//   x1 = 0;
//   y1 = 0;
//   x2 = 0;
//   y2 = 0;
//   constructor(x1, y1, x2, y2) {
//     super(ACTION_TYPE.MOVE);

//     this.x1 = x1;
//     this.y1 = y1;
//     this.x2 = x2;
//     this.y2 = y2;
//   }
// }

class MovementPlan {
  segments = null;
  targetSpeed = 0;
  acceleration = 0;
  constructor(segments, options) {
    this.segments = segments;

    const { targetSpeed, acceleration } = options;

    this.targetSpeed = targetSpeed;
    this.acceleration = acceleration;

    this._plan();
  }
  _planSegment = (x1, y1, x2, y2, initialSpeed, finalSpeed) => {
    const distance = Math.hypot(x1 - x2, y1 - y2);
    const initialDelta = this.targetSpeed - initialSpeed;
    const finalDelta = this.targetSpeed - finalSpeed;

    if (initialDelta === 0 && finalDelta === 0) {
      return [];
    }

    if (
      distance >
      initialDelta / this.acceleration + finalDelta / this.acceleration
    ) {
    }

    let output = [];

    return output;
  };
  _plan = () => {
    let position = {
      x: 0,
      y: 0,
    };
    let actions = [];

    this.segments.forEach((segment) => {
      let movements = [];
      let lastPosition = {
        x: segment[0],
        y: segment[1],
      };

      for (let i = 2; i < segment.length; i += 2) {
        const x = segment[i];
        const y = segment[i + 1];

        // movements.push(new Movement(lastPosition.x, lastPosition.y, x, y));
      }

      actions.push(
        /** Move to first position, Lower pen, */ ...movements /** Raise pen */
      );
    });
  };
}

function getAxisSpeeds(x1, y1, x2, y2, speed) {
  const deltaX = x1 - x2;
  const deltaY = y1 - y2;

  // Distance between the two points, in millimeters
  const distance = Math.hypot(deltaX, deltaY);
  // Time to move between these two points
  const time = distance / speed;

  // Find the speed required for each axis individually
  const speedX = deltaX / time;
  const speedY = deltaY / time;

  return [speedX, speedY];
}
