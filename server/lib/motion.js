import logger from 'loglevel';
import colors from 'colors/safe.js';

import {
  getSMCommand,
  getLMCommand,
  getServoPosition,
  getPenCommand,
} from './movement.js';

const EPSILON = 0.01;
const MIN_FALLBACK_SPEED = 5;

export class MotionSegment {
  constructor(pointA, pointB) {
    this.x1 = pointA.x;
    this.y1 = pointA.y;
    this.x2 = pointB.x;
    this.y2 = pointB.y;
    this.entrySpeed = 0;
    this.deltaX = pointB.x - pointA.x;
    this.deltaY = pointB.y - pointA.y;
    this.distance = Math.hypot(this.deltaX, this.deltaY);
    this.direction = [0, 0];

    if (this.distance > 0) {
      this.direction = [
        this.deltaX / this.distance,
        this.deltaY / this.distance,
      ];
    }
  }
}

export class MotionPlanner {
  constructor(machine) {
    this.machine = machine;

    const { stepper, servo } = this.machine;
    this.minCommandDistance = 1 / stepper.stepsPerMM;

    this.penDownPosition = getServoPosition(
      servo.minPosition,
      servo.maxPosition,
      servo.downPercent,
    );
    this.penUpPosition = getServoPosition(
      servo.minPosition,
      servo.maxPosition,
      servo.upPercent,
    );
  }
  plan = (pathList) => {
    const { stepper, servo } = this.machine;
    const { upSpeed, downSpeed } = stepper;
    const position = { x: 0, y: 0 };

    const startCommands = [
      getPenCommand(this.penUpPosition, servo.rate),
      servo.duration,
    ];
    const commands = pathList.reduce((result, path) => {
      if (path.length < 2) return result;

      let prevMotionSegment = null;
      const motionSegments = [];

      // Convert the path into a list of motion segment instances
      for (let i = 0; i < path.length - 1; i++) {
        const motionSegment = new MotionSegment(path[i], path[i + 1]);
        if (motionSegment.length === 0) continue;
        if (prevMotionSegment) {
          motionSegment.entrySpeed = this._getCornerSpeed(
            prevMotionSegment,
            motionSegment,
            downSpeed,
          );
        }

        motionSegments.push(motionSegment);
        prevMotionSegment = motionSegment;
      }

      if (motionSegments.length > 0) {
        // Adjust the speeds to stay within the allowed acceleration
        this._smoothMotionSpeeds(motionSegments);

        // Move to the beginning of the first segment
        const penUpSegment = new MotionSegment(position, {
          x: motionSegments[0].x1,
          y: motionSegments[0].y1,
        });
        const penUpCommands = this._getSegmentCommands(
          penUpSegment,
          0,
          0,
          upSpeed,
        );

        // Add the pen up motion commands
        if (penUpCommands.length > 0) {
          result.push(...penUpCommands);
        }

        // Lower the pen
        // result.push(...this._penDown());

        // Create commands
        for (let i = 0; i < motionSegments.length; i++) {
          const currentSegment = motionSegments[i];
          const nextSegment = motionSegments[i + 1];

          const { entrySpeed } = currentSegment;
          const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

          result.push(
            ...this._getSegmentCommands(
              currentSegment,
              entrySpeed,
              nextEntrySpeed,
              downSpeed,
            ),
          );
        }

        // Raise the pen
        // result.push(...this._penUp());
      } else {
        logger.warn(
          colors.yellow('[Serial]: Skipping path with no motion segments.'),
        );
      }

      // Update the position
      position.x = path[path.length - 1].x;
      position.y = path[path.length - 1].y;

      return result;
    }, startCommands);

    const homeSegment = new MotionSegment(position, { x: 0, y: 0 });

    return [
      ...commands,
      ...this._getSegmentCommands(homeSegment, 0, 0, upSpeed),
    ];
  };
  _penDown = () => {
    const { servo } = this.machine;
    return [getPenCommand(this.penDownPosition, servo.rate), servo.duration];
  };
  _penUp = () => {
    const { servo } = this.machine;
    return [getPenCommand(this.penUpPosition, servo.rate), servo.duration];
  };
  _getSegmentCommands = (motionSegment, entrySpeed, exitSpeed, maxSpeed) => {
    const segmentLength = motionSegment.distance;
    const segmentDirection = motionSegment.direction;
    const { x1, y1, x2, y2 } = motionSegment;
    const { stepper } = this.machine;

    if (segmentLength < this.minCommandDistance) {
      return [];
    }

    // Check if the speed difference is possible given this distance and
    // acceleration.
    if (!this._speedsArePossible(entrySpeed, exitSpeed, segmentLength)) {
      throw new Error(
        'Cannot get motion commands for segment; speed delta is too great',
      );
    }

    if (segmentLength < this.minCommandDistance * 2) {
      if (entrySpeed === 0 && exitSpeed === 0) {
        // If both speeds are zero, moving directly would throw an error. In this
        // case, a minimum fallback speed is used.
        return getSMCommand(x1, y1, x2, y2, MIN_FALLBACK_SPEED, stepper);
      } else {
        return getLMCommand(x1, y1, x2, y2, entrySpeed, exitSpeed, stepper);
      }
    }

    const motionProfile = this._getMotionProfile(
      entrySpeed,
      exitSpeed,
      maxSpeed,
      segmentLength,
    );

    let prevX = x1;
    let prevY = y1;
    let lastSpeed = entrySpeed;
    let commands = [];

    // Build the commands
    motionProfile.forEach(([distance, speed]) => {
      const pointX = x1 + segmentDirection[0] * distance;
      const pointY = y1 + segmentDirection[1] * distance;

      commands.push(
        ...getLMCommand(
          prevX,
          prevY,
          pointX,
          pointY,
          lastSpeed,
          speed,
          stepper,
        ),
      );

      prevX = pointX;
      prevY = pointY;
      lastSpeed = speed;
    });

    // Attach the final command
    commands.push(
      ...getLMCommand(prevX, prevY, x2, y2, lastSpeed, exitSpeed, stepper),
    );

    return commands;
  };
  _speedsArePossible = (entrySpeed, exitSpeed, distance) => {
    if (entrySpeed === exitSpeed) {
      return true;
    }

    const { planning } = this.machine;
    const delta = Math.abs(exitSpeed * exitSpeed - entrySpeed * entrySpeed);
    const acceleration = delta / (2 * distance);

    return acceleration - planning.acceleration < EPSILON;
  };
  _getMotionProfile = (entrySpeed, exitSpeed, maxSpeed, segmentLength) => {
    const { acceleration } = this.machine.planning;

    const accelTime = (maxSpeed - entrySpeed) / acceleration;
    const accelDistance = (entrySpeed + maxSpeed) * 0.5 * accelTime;
    const decelTime = (maxSpeed - exitSpeed) / acceleration;
    const decelDistance = (exitSpeed + maxSpeed) * 0.5 * decelTime;

    const profile = [];

    const cruiseDistance = segmentLength - (accelDistance + decelDistance);
    if (cruiseDistance > 0) {
      // Trapezoid speed profile
      profile.push([accelDistance, maxSpeed]);
      profile.push([accelDistance + cruiseDistance, maxSpeed]);
    } else {
      // Triangle speed profile
      const entrySpeedSqr = entrySpeed * entrySpeed;
      const exitSpeedSqr = exitSpeed * exitSpeed;
      const peakDistance =
        (2 * acceleration * segmentLength + exitSpeedSqr - entrySpeedSqr) /
        (4 * acceleration);
      const peakSpeed = this._getSpeed(entrySpeed, peakDistance, acceleration);

      profile.push([peakDistance, peakSpeed]);
    }

    let prevDistance = 0;

    // Filter out points that are either too close to the ends of the segment or
    // too close to the previous point.

    return profile.reduce((result, point) => {
      const [distance] = point;

      if (
        distance > this.minCommandDistance &&
        segmentLength - distance > this.minCommandDistance &&
        distance - prevDistance > this.minCommandDistance
      ) {
        result.push(point);
      }

      prevDistance = distance;

      return result;
    }, []);
  };
  _smoothMotionSpeeds = (motionSegments) => {
    let index = 0;
    while (index < motionSegments.length) {
      const currentSegment = motionSegments[index];
      const nextSegment = motionSegments[index + 1];
      const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

      if (
        !this._speedsArePossible(
          currentSegment.entrySpeed,
          nextEntrySpeed,
          currentSegment.distance,
        )
      ) {
        if (currentSegment.entrySpeed > nextEntrySpeed) {
          currentSegment.entrySpeed = this._getSpeed(
            nextEntrySpeed,
            currentSegment.distance,
          );
          index--;
          continue;
        } else {
          nextSegment.entrySpeed = this._getSpeed(
            currentSegment.entrySpeed,
            currentSegment.distance,
          );
          index++;
          continue;
        }
      }
      index++;
    }
  };
  _getSpeed = (startSpeed, distance) => {
    const { acceleration } = this.machine.planning;
    return Math.sqrt(startSpeed * startSpeed + 2 * acceleration * distance);
  };
  _getCornerSpeed = (segmentA, segmentB, maxSpeed) => {
    // https://onehossshay.wordpress.com/2011/09/24/improving_grbl_cornering_algorithm/
    // https://github.com/fogleman/axi/blob/master/axi/planner.py#L152
    const cosine = -dot(segmentA.direction, segmentB.direction);
    if (Math.abs(cosine - 1) < 0) {
      return 0;
    }

    const sine = Math.sqrt((1 - cosine) * 0.5);
    if (Math.abs(sine - 1) < 0) {
      return maxSpeed;
    }

    const { acceleration, cornerFactor } = this.machine.planning;
    const cornerSpeed = Math.sqrt(
      (acceleration * cornerFactor * sine) / (1 - sine),
    );
    return clamp(cornerSpeed, 0, maxSpeed);
  };
}

function dot(vector1, vector2) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
