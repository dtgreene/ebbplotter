import logger from 'loglevel';

import {
  MIN_COMMAND_DISTANCE,
  MIN_MOTION_PROFILE_DISTANCE,
  MIN_MOTION_DELTA_TOLERANCE,
  MIN_MOTION_SPEED,
  MOTION_ACCELERATION,
  MOTION_CORNER_FACTOR,
  PEN_DOWN_SPEED,
  PEN_UP_SPEED,
  SERVO_DURATION,
} from './config.js';
import { COMMANDS, PEN_STATES } from './ebb.js';

export function getMotionSegment(x1, y1, x2, y2) {
  const entrySpeed = MIN_MOTION_SPEED;
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;

  let length = Math.hypot(deltaX, deltaY);
  let direction = [0, 0];
  let maxSpeedDelta = 0;

  if (length > 0) {
    direction = [deltaX / length, deltaY / length];
    maxSpeedDelta = Math.sqrt(
      entrySpeed * entrySpeed + 2 * MOTION_ACCELERATION * length
    );
  }

  return { x1, y1, x2, y2, entrySpeed, length, direction, maxSpeedDelta };
}

export function getMotionPlan(path, position = { x: 0, y: 0 }) {
  if (path.length % 2 !== 0) {
    throw new Error(`Invalid path length: ${path.length}`);
  }

  let commands = [];
  let motionSegments = [];

  // Convert the path into a list of motion segment instances
  for (let i = 0; i < path.length - 2; i += 2) {
    const x1 = path[i];
    const y1 = path[i + 1];
    const x2 = path[i + 2];
    const y2 = path[i + 3];
    const motionSegment = getMotionSegment(x1, y1, x2, y2);
    const previousSegment = motionSegments[motionSegments.length - 1];

    if (motionSegment.length === 0) {
      logger.warn('Skipping zero-length motion segment.');
      continue;
    }

    if (previousSegment) {
      motionSegment.entrySpeed = getCornerSpeed(
        previousSegment,
        motionSegment,
        PEN_DOWN_SPEED
      );
    }

    motionSegments.push(motionSegment);
  }

  if (motionSegments.length > 0) {
    const firstSegment = motionSegments[0];
    const penUpSegment = getMotionSegment(
      position.x,
      position.y,
      firstSegment.x1,
      firstSegment.y1
    );
    const penUpCommands = getSegmentCommands(penUpSegment, PEN_UP_SPEED, 0, 0);

    // Add the pen up motion commands
    if (penUpCommands.length > 0) {
      commands = commands.concat(penUpCommands);
    }
    // Lower the pen
    commands.push(COMMANDS.setPenState(PEN_STATES.down), SERVO_DURATION);

    // Smooth speeds
    checkFutureSpeeds(motionSegments);

    // Create commands
    for (let i = 0; i < motionSegments.length; i++) {
      const currentSegment = motionSegments[i];
      const nextSegment = motionSegments[i + 1];

      const { entrySpeed } = currentSegment;
      const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

      commands = commands.concat(
        getSegmentCommands(
          currentSegment,
          PEN_DOWN_SPEED,
          entrySpeed,
          nextEntrySpeed
        )
      );
    }
    // Raise the pen
    commands.push('SP,0', SERVO_DURATION);
  } else {
    logger.warn('Skipping path with no motion segments.');
  }

  // Update the position
  position.x = path[path.length - 2];
  position.y = path[path.length - 1];

  return commands;
}

export function getSegmentCommands(
  motionSegment,
  maxSpeed,
  entrySpeed,
  exitSpeed
) {
  const segmentLength = motionSegment.length;
  const { x1, y1, x2, y2, maxSpeedDelta } = motionSegment;

  if (segmentLength < MIN_COMMAND_DISTANCE) {
    return [];
  }

  // Check if the speed difference is possible given this distance and
  // acceleration.
  if (!isValidDelta(entrySpeed, exitSpeed, maxSpeedDelta)) {
    throw new Error(
      'Cannot get motion commands for segment; speed delta is too great'
    );
  }

  // Twice the minimum plan distance is the shortest distance possible to plan.
  // For segments shorter than that, travel directly between the two points.
  // This would be accounted for below but we can shortcut that by checking
  // here.
  if (segmentLength < MIN_MOTION_PROFILE_DISTANCE * 2) {
    return getMotionCommand(x1, y1, x2, y2, entrySpeed, exitSpeed);
  }

  const accelerationTime = (maxSpeed - entrySpeed) / MOTION_ACCELERATION;
  const accelerationDistance = ((entrySpeed + maxSpeed) / 2) * accelerationTime;
  const decelerationTime = (maxSpeed - exitSpeed) / MOTION_ACCELERATION;
  const decelerationDistance = ((exitSpeed + maxSpeed) / 2) * decelerationTime;

  const accelerationLine = [0, entrySpeed, accelerationDistance, maxSpeed];
  const decelerationLine = [
    segmentLength - decelerationDistance,
    maxSpeed,
    segmentLength,
    exitSpeed,
  ];

  // The point where the two changing lines intersect
  const intersection = getLineIntersection(accelerationLine, decelerationLine);
  // Create the speed profile as either a triangle or trapezoid.  This isn't the
  // final profile and might change if some points are too close together.
  const profile = intersection ?? [
    accelerationLine[2],
    accelerationLine[3],
    decelerationLine[0],
    decelerationLine[1],
  ];
  const profileFinal = [];

  // Filter out points in the profile
  for (let i = 0; i < profile.length; i += 2) {
    const distance = profile[i];
    const neighborDistance = profile[i + 2] ?? Infinity;

    if (
      distance >= MIN_MOTION_PROFILE_DISTANCE &&
      segmentLength - distance >= MIN_MOTION_PROFILE_DISTANCE &&
      neighborDistance - distance >= MIN_MOTION_PROFILE_DISTANCE
    ) {
      profileFinal.push(profile[i], profile[i + 1]);
    }
  }

  if (profileFinal.length > 0) {
    let lastX = x1;
    let lastY = y1;
    let lastSpeed = entrySpeed;
    let commands = [];

    // Build the commands
    for (let i = 0; i < profileFinal.length; i += 2) {
      const distance = profileFinal[i];
      const speed = profileFinal[i + 1];
      const [pointX, pointY] = getLinePoint(
        x1,
        y1,
        x2,
        y2,
        distance / segmentLength
      );
      commands = commands.concat(
        getMotionCommand(lastX, lastY, pointX, pointY, lastSpeed, speed)
      );

      lastX = pointX;
      lastY = pointY;
      lastSpeed = speed;
    }

    // Get the final command
    commands = commands.concat(
      getMotionCommand(lastX, lastY, x2, y2, lastSpeed, exitSpeed)
    );

    return commands;
  } else {
    return getMotionCommand(x1, y1, x2, y2, entrySpeed, exitSpeed);
  }
}

function checkFutureSpeeds(motionSegments) {
  for (let i = 0; i < motionSegments.length; i++) {
    const currentSegment = motionSegments[i];
    const nextSegment = motionSegments[i + 1];

    const { entrySpeed, maxSpeedDelta } = currentSegment;
    const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

    // If the next segment's entry speed is too great, it can simply be lowered.
    // However if the problem lies with the current entry speed, changing it
    // requires looking back at previous speeds.
    if (!isValidDelta(entrySpeed, nextEntrySpeed, maxSpeedDelta)) {
      if (entrySpeed > nextEntrySpeed) {
        currentSegment.entrySpeed = nextEntrySpeed + maxSpeedDelta;
        // Look backwards from this point until no corrections need to be made
        checkPastSpeeds(motionSegments, i);
      } else {
        nextSegment.entrySpeed = entrySpeed + maxSpeedDelta;
      }
    }
  }
}

function checkPastSpeeds(motionSegments, index) {
  // Skip checking the first segment
  for (let i = index; i > 0; i--) {
    const currentSegment = motionSegments[i];
    const previousSegment = motionSegments[i - 1];

    const { entrySpeed, maxSpeedDelta } = previousSegment;
    if (!isValidDelta(entrySpeed, currentSegment.entrySpeed, maxSpeedDelta)) {
      if (entrySpeed > currentSegment.entrySpeed) {
        previousSegment.entrySpeed = currentSegment.entrySpeed + maxSpeedDelta;
      } else {
        // Since speeds are only being lowered, this should never be the case.
        // For this to be possible, something must have gone wrong.
        throw new Error('Could not set previous speeds');
      }
    } else {
      // Checking previous segments can stop once a valid speed difference is
      // found.
      break;
    }
  }
}

function getMotionCommand(x1, y1, x2, y2, entrySpeed, exitSpeed) {
  let targetEntrySpeed = entrySpeed;
  let targetExitSpeed = exitSpeed;

  if (targetEntrySpeed === 0 && targetExitSpeed === 0) {
    targetEntrySpeed = MIN_MOTION_SPEED;
    targetExitSpeed = MIN_MOTION_SPEED;
  }

  return COMMANDS.stepperMoveAccelerated(
    x1,
    y1,
    x2,
    y2,
    targetEntrySpeed,
    targetExitSpeed
  );
}

function isValidDelta(speed1, speed2, maxDelta) {
  return Math.abs(speed1 - speed2) - maxDelta <= MIN_MOTION_DELTA_TOLERANCE;
}

function getLinePoint(x1, y1, x2, y2, r) {
  return [r * x2 + (1 - r) * x1, r * y2 + (1 - r) * y1];
}

function getLineIntersection([a, b, c, d], [p, q, r, s]) {
  const z1 = a - c;
  const z2 = p - r;
  const z3 = b - d;
  const z4 = q - s;
  const dist = z1 * z4 - z3 * z2;

  if (dist === 0) return null;

  const tempA = a * d - b * c;
  const tempB = p * s - q * r;
  const xCoor = (tempA * z2 - z1 * tempB) / dist;
  const yCoor = (tempA * z4 - z3 * tempB) / dist;

  if (
    xCoor < Math.min(a, c) ||
    xCoor > Math.max(a, c) ||
    xCoor < Math.min(p, r) ||
    xCoor > Math.max(p, r)
  ) {
    return null;
  }
  if (
    yCoor < Math.min(b, d) ||
    yCoor > Math.max(b, d) ||
    yCoor < Math.min(q, s) ||
    yCoor > Math.max(q, s)
  ) {
    return null;
  }

  return [xCoor, yCoor];
}

function getCornerSpeed(segmentA, segmentB, maxSpeed) {
  const direction1 = segmentA.direction;
  const direction2 = segmentB.direction;

  // Calculate the dot product and determine the angle between the vectors
  const angle = dot(direction1, direction2);
  const theta = Math.acos(angle / (mag(direction1) * mag(direction2)));

  const length = segmentA.length;
  const radius = length / (2 * Math.sin(theta / 2));

  // Calculate cornering speed based on the radius
  const cornerSpeed = Math.sqrt(MOTION_CORNER_FACTOR * radius);

  const min = Math.min(cornerSpeed, maxSpeed);
  const max = Math.max(min, MIN_MOTION_SPEED);

  return max;
}

function dot(vector1, vector2) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1];
}

function mag(vector) {
  return Math.sqrt(vector[0] ** 2 + vector[1] ** 2);
}
