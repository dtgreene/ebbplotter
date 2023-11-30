import logger from 'loglevel';

import { getSMCommand, getLMCommand } from './movement.js';
import { orange } from './utils.js';

const EPSILON = 0.01;
const MIN_FALLBACK_SPEED = 5;

class MotionSegment {
  constructor(pathA, pathB) {
    this.x1 = pathA.x;
    this.y1 = pathA.y;
    this.x2 = pathB.x;
    this.y2 = pathB.y;
    this.entrySpeed = 0;
    this.deltaX = pathB.x - pathA.x;
    this.deltaY = pathB.y - pathA.y;
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
  constructor(pathList, machine) {
    this.machine = machine;
    this.pathList = pathList;
    this.index = 0;
    this.position = { x: 0, y: 0 };

    const { stepsPerMM } = this.machine.stepper;
    this.minCommandDistance = 1 / stepsPerMM;
  }
  next = () => {
    const path = this.pathList[this.index++];

    if (!path) return null;

    // TODO: handle single point paths
    if (path.length === 0 || path.length % 2 !== 0) {
      logger.warn(orange('Skipping empty path.'));
    }

    let commands = [];
    let motionSegments = [];
    let prevMotionSegment = null;

    const { servo, stepper } = this.machine;
    const { upSpeed, downSpeed } = stepper;

    // Convert the path into a list of motion segment instances
    for (let i = 0; i < path.length - 1; i++) {
      const motionSegment = new MotionSegment(path[i], path[i + 1]);

      if (motionSegment.length === 0) {
        logger.warn(orange('Skipping zero-length motion segment.'));
        continue;
      }

      if (prevMotionSegment) {
        motionSegment.entrySpeed = this.getCornerSpeed(
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
      this.smoothMotionSpeeds(motionSegments);

      // Move to the beginning of the first segment
      const firstSegment = motionSegments[0];
      const penUpSegment = new MotionSegment(
        this.position.x,
        this.position.y,
        firstSegment.x1,
        firstSegment.y1,
      );
      const penUpCommands = this.getSegmentCommands(
        penUpSegment,
        0,
        0,
        upSpeed,
      );

      // Add the pen up motion commands
      if (penUpCommands.length > 0) {
        commands = commands.concat(penUpCommands);
      }
      // Lower the pen
      commands.push('SP,1', servo.duration);

      // Create commands
      for (let i = 0; i < motionSegments.length; i++) {
        const currentSegment = motionSegments[i];
        const nextSegment = motionSegments[i + 1];

        const { entrySpeed } = currentSegment;
        const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

        commands = commands.concat(
          this.getSegmentCommands(
            currentSegment,
            entrySpeed,
            nextEntrySpeed,
            downSpeed,
          ),
        );
      }

      // Raise the pen
      commands.push('SP,0', servo.duration);
    } else {
      logger.warn(orange('Skipping path with no motion segments.'));
    }

    // Update the position
    this.position.x = path[path.length - 2];
    this.position.y = path[path.length - 1];

    return commands;
  };
  getSegmentCommands = (motionSegment, entrySpeed, exitSpeed, maxSpeed) => {
    const segmentLength = motionSegment.distance;
    const segmentDirection = motionSegment.direction;
    const { x1, y1, x2, y2 } = motionSegment;
    const { stepper } = this.machine;

    if (segmentLength < this.minCommandDistance) {
      return [];
    }

    // Check if the speed difference is possible given this distance and
    // acceleration.
    if (!this.speedsArePossible(entrySpeed, exitSpeed, segmentLength)) {
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

    const motionProfile = this.getMotionProfile(
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

      commands = commands.concat(
        getLMCommand(prevX, prevY, pointX, pointY, lastSpeed, speed, stepper),
      );

      prevX = pointX;
      prevY = pointY;
      lastSpeed = speed;
    });

    // Attach the final command
    commands = commands.concat(
      getLMCommand(prevX, prevY, x2, y2, lastSpeed, exitSpeed, stepper),
    );

    return commands;
  };
  speedsArePossible = (entrySpeed, exitSpeed, distance) => {
    if (entrySpeed === exitSpeed) {
      return true;
    }

    const { planner } = this.machine;
    const delta = Math.abs(exitSpeed * exitSpeed - entrySpeed * entrySpeed);
    const acceleration = delta / (2 * distance);

    return acceleration - planner.acceleration < EPSILON;
  };
  getMotionProfile = (entrySpeed, exitSpeed, maxSpeed, segmentLength) => {
    const { acceleration } = this.machine.planner;

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
      const peakSpeed = this.getSpeed(entrySpeed, peakDistance, acceleration);

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
  smoothMotionSpeeds = (motionSegments) => {
    let index = 0;
    while (index < motionSegments.length) {
      const currentSegment = motionSegments[index];
      const nextSegment = motionSegments[index + 1];
      const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

      if (
        !this.speedsArePossible(
          currentSegment.entrySpeed,
          nextEntrySpeed,
          currentSegment.distance,
        )
      ) {
        if (currentSegment.entrySpeed > nextEntrySpeed) {
          currentSegment.entrySpeed = this.getSpeed(
            nextEntrySpeed,
            currentSegment.distance,
          );
          index--;
          continue;
        } else {
          nextSegment.entrySpeed = this.getSpeed(
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
  getSpeed = (startSpeed, distance) => {
    const { acceleration } = this.machine.planner;
    return Math.sqrt(startSpeed * startSpeed + 2 * acceleration * distance);
  };
  getCornerSpeed = (segmentA, segmentB, maxSpeed) => {
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

    const { acceleration, cornerFactor } = this.machine.planner;
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
