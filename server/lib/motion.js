import logger from 'loglevel';

import { Config } from './config.js';
import { getSMCommand, getLMCommand } from './movement.js';

const EPSILON = 0.01;
const MIN_FALLBACK_SPEED = 5;

class MotionSegment {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.entrySpeed = 0;
    this.deltaX = x2 - x1;
    this.deltaY = y2 - y1;
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

export function getMotionPlan(path, position) {
  if (path.length === 0 || path.length % 2 !== 0) {
    throw new Error(`Invalid path length: ${path.length}`);
  }

  let commands = [];
  let motionSegments = [];

  const { SERVO } = Config;
  const { UP_SPEED, DOWN_SPEED } = Config.STEPPER;

  // Convert the path into a list of motion segment instances
  for (let i = 0; i < path.length - 2; i += 2) {
    const x1 = path[i];
    const y1 = path[i + 1];
    const x2 = path[i + 2];
    const y2 = path[i + 3];
    const motionSegment = new MotionSegment(x1, y1, x2, y2);
    const prevSegment = motionSegments[motionSegments.length - 1];

    if (motionSegment.length === 0) {
      logger.warn('Skipping zero-length motion segment.');
      continue;
    }

    if (prevSegment) {
      motionSegment.entrySpeed = getCornerSpeed(
        prevSegment,
        motionSegment,
        DOWN_SPEED,
      );
    }

    motionSegments.push(motionSegment);
  }

  if (motionSegments.length > 0) {
    // Adjust the speeds to stay within the allowed acceleration
    smoothMotionSpeeds(motionSegments);

    // Move to the beginning of the first segment
    const firstSegment = motionSegments[0];
    const penUpSegment = new MotionSegment(
      position.x,
      position.y,
      firstSegment.x1,
      firstSegment.y1,
    );
    const penUpCommands = getSegmentCommands(penUpSegment, 0, 0, UP_SPEED);

    // Add the pen up motion commands
    if (penUpCommands.length > 0) {
      commands = commands.concat(penUpCommands);
    }
    // Lower the pen
    commands.push('SP,1', SERVO.DURATION);

    // Create commands
    for (let i = 0; i < motionSegments.length; i++) {
      const currentSegment = motionSegments[i];
      const nextSegment = motionSegments[i + 1];

      const { entrySpeed } = currentSegment;
      const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

      commands = commands.concat(
        getSegmentCommands(
          currentSegment,
          entrySpeed,
          nextEntrySpeed,
          DOWN_SPEED,
        ),
      );
    }

    // Raise the pen
    commands.push('SP,0', SERVO.DURATION);
  } else {
    logger.warn('Skipping path with no motion segments.');
  }

  // Update the position
  position.x = path[path.length - 2];
  position.y = path[path.length - 1];

  return commands;
}

function getSegmentCommands(motionSegment, entrySpeed, exitSpeed, maxSpeed) {
  const { MIN_COMMAND_DISTANCE } = Config.STEPPER;

  const segmentLength = motionSegment.distance;
  const segmentDirection = motionSegment.direction;
  const { x1, y1, x2, y2 } = motionSegment;

  if (segmentLength < MIN_COMMAND_DISTANCE) {
    return [];
  }

  // Check if the speed difference is possible given this distance and
  // acceleration.
  if (!speedsArePossible(entrySpeed, exitSpeed, segmentLength)) {
    throw new Error(
      'Cannot get motion commands for segment; speed delta is too great',
    );
  }

  if (segmentLength < MIN_COMMAND_DISTANCE * 2) {
    if (entrySpeed === 0 && exitSpeed === 0) {
      // If both speeds are zero, moving directly would throw an error. In this
      // case, a minimum fallback speed is used.
      return getSMCommand(x1, y1, x2, y2, MIN_FALLBACK_SPEED);
    } else {
      return getLMCommand(x1, y1, x2, y2, entrySpeed, exitSpeed);
    }
  }

  const motionProfile = getMotionProfile(
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
      getLMCommand(prevX, prevY, pointX, pointY, lastSpeed, speed),
    );

    prevX = pointX;
    prevY = pointY;
    lastSpeed = speed;
  });

  // Attach the final command
  commands = commands.concat(
    getLMCommand(prevX, prevY, x2, y2, lastSpeed, exitSpeed),
  );

  return commands;
}

function getMotionProfile(entrySpeed, exitSpeed, maxSpeed, segmentLength) {
  const { ACCELERATION } = Config.PLANNER;
  const { MIN_COMMAND_DISTANCE } = Config.STEPPER;

  const accelerationTime = (maxSpeed - entrySpeed) / ACCELERATION;
  const accelerationDistance = (entrySpeed + maxSpeed) * 0.5 * accelerationTime;
  const decelerationTime = (maxSpeed - exitSpeed) / ACCELERATION;
  const decelerationDistance = (exitSpeed + maxSpeed) * 0.5 * decelerationTime;

  const profile = [];

  const cruiseDistance =
    segmentLength - (accelerationDistance + decelerationDistance);
  if (cruiseDistance > 0) {
    // Trapezoid speed profile
    profile.push([accelerationDistance, maxSpeed]);
    profile.push([accelerationDistance + cruiseDistance, maxSpeed]);
  } else {
    // Triangle speed profile
    const entrySpeedSqr = entrySpeed * entrySpeed;
    const exitSpeedSqr = exitSpeed * exitSpeed;
    const peakDistance =
      (2 * ACCELERATION * segmentLength + exitSpeedSqr - entrySpeedSqr) /
      (4 * ACCELERATION);
    const peakSpeed = getSpeed(entrySpeed, peakDistance, ACCELERATION);

    profile.push([peakDistance, peakSpeed]);
  }

  let prevDistance = 0;

  // Filter out points that are either too close to the ends of the segment or
  // too close to the previous point.

  return profile.reduce((result, point) => {
    const [distance] = point;

    if (
      distance > MIN_COMMAND_DISTANCE &&
      segmentLength - distance > MIN_COMMAND_DISTANCE &&
      distance - prevDistance > MIN_COMMAND_DISTANCE
    ) {
      result.push(point);
    }

    prevDistance = distance;

    return result;
  }, []);
}

function smoothMotionSpeeds(motionSegments) {
  let index = 0;
  while (index < motionSegments.length) {
    const currentSegment = motionSegments[index];
    const nextSegment = motionSegments[index + 1];
    const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

    if (
      !speedsArePossible(
        currentSegment.entrySpeed,
        nextEntrySpeed,
        currentSegment.distance,
      )
    ) {
      if (currentSegment.entrySpeed > nextEntrySpeed) {
        currentSegment.entrySpeed = getSpeed(
          nextEntrySpeed,
          currentSegment.distance,
        );
        index--;
        continue;
      } else {
        nextSegment.entrySpeed = getSpeed(
          currentSegment.entrySpeed,
          currentSegment.distance,
        );
        index++;
        continue;
      }
    }
    index++;
  }
}

function getSpeed(startSpeed, distance) {
  const { ACCELERATION } = Config.PLANNER;

  return Math.sqrt(startSpeed * startSpeed + 2 * ACCELERATION * distance);
}

function speedsArePossible(entrySpeed, exitSpeed, distance) {
  const { ACCELERATION } = Config.PLANNER;

  if (entrySpeed === exitSpeed) {
    return true;
  }
  const delta =
    Math.abs(exitSpeed * exitSpeed - entrySpeed * entrySpeed) / (2 * distance) -
    ACCELERATION;

  return delta < EPSILON;
}

function getCornerSpeed(segment1, segment2, maxSpeed) {
  const { ACCELERATION, CORNER_FACTOR } = Config.PLANNER;
  // https://onehossshay.wordpress.com/2011/09/24/improving_grbl_cornering_algorithm/
  // https://github.com/fogleman/axi/blob/master/axi/planner.py#L152
  const cosine = -dot(segment1.direction, segment2.direction);
  if (Math.abs(cosine - 1) < 0) {
    return 0;
  }

  const sine = Math.sqrt((1 - cosine) * 0.5);
  if (Math.abs(sine - 1) < 0) {
    return maxSpeed;
  }

  const cornerSpeed = Math.sqrt(
    (ACCELERATION * CORNER_FACTOR * sine) / (1 - sine),
  );
  return clamp(cornerSpeed, 0, maxSpeed);
}

function dot(vector1, vector2) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
