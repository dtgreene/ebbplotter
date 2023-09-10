import logger from 'loglevel';

import {
  STEPS_PER_MM,
  MIN_COMMAND_DISTANCE,
  MIN_MOTION_PROFILE_DISTANCE,
  MIN_MOTION_DELTA_TOLERANCE,
  MIN_MOTION_SPEED,
  MOTION_ACCELERATION,
  INVERT_X_AXIS,
  INVERT_Y_AXIS,
  PEN_DOWN_SPEED,
  PEN_UP_SPEED,
  SERVO_DURATION,
} from './config.js';

const CYCLES_PER_SECOND = 25_000;
const LM_ACC_PER_SECOND = 2 ** 31 / CYCLES_PER_SECOND;

export class MotionSegment {
  entrySpeed = 0;
  constructor(x1, y1, x2, y2) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;

    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const length = Math.hypot(deltaX, deltaY);

    if (!isNaN(length) && length > 0) {
      this.length = length;
      this.direction = [deltaX / length, deltaY / length];
      this.maxSpeedDelta = Math.sqrt(2 * MOTION_ACCELERATION * length);
    } else {
      this.length = 0;
      this.direction = [0, 0];
      this.maxSpeedDelta = 0;
    }
  }
}

function dot(vector1, vector2) {
  return vector1[0] * vector2[0] + vector1[1] * vector2[1];
}

function mag(vector) {
  return Math.sqrt(vector[0] ** 2 + vector[1] ** 2);
}

export function getMotionPlan(path, position = { x: 0, y: 0 }) {
  let commands = [];

  if (path.length < 4 || path.length % 2 !== 0) {
    throw new Error(`Invalid path length: ${path.length}`);
  }

  // Create motion segment instances
  let motionSegments = [];

  for (let i = 0; i < path.length - 2; i += 2) {
    const x1 = path[i];
    const y1 = path[i + 1];
    const x2 = path[i + 2];
    const y2 = path[i + 3];
    const motionSegment = new MotionSegment(x1, y1, x2, y2);
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
    const penUpSegment = new MotionSegment(
      position.x,
      position.y,
      firstSegment.x1,
      firstSegment.y1
    );
    const penUpCommands = getMotionCommands(penUpSegment, PEN_UP_SPEED, 0, 0);

    // Add the pen up motion commands
    if (penUpCommands.length > 0) {
      commands = commands.concat(penUpCommands);
    }
    // Lower the pen
    commands.push('SP,1', SERVO_DURATION);

    // Smooth speeds
    checkFutureSpeeds(motionSegments);

    // Create commands
    for (let i = 0; i < motionSegments.length; i++) {
      const currentSegment = motionSegments[i];
      const nextSegment = motionSegments[i + 1];

      const { entrySpeed } = currentSegment;
      const nextEntrySpeed = nextSegment ? nextSegment.entrySpeed : 0;

      commands = commands.concat(
        getMotionCommands(
          currentSegment,
          PEN_DOWN_SPEED,
          entrySpeed,
          nextEntrySpeed
        )
      );
    }

    const lastSegment = motionSegments[motionSegments.length - 1];

    // Update the current position
    position.x = lastSegment.x2;
    position.y = lastSegment.y2;

    // Raise the pen
    commands.push('SP,0', SERVO_DURATION);
  } else {
    logger.warn('Skipping path with no motion segments.');
  }

  return commands;
}

function getFirstCommands({ x, y }, { x1, y1 }) {
  const firstSegment = new MotionSegment(x, y, x1, y1);
  const firstCommands = getMotionCommands(firstSegment, PEN_UP_SPEED, 0, 0);
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

export function getMotionCommands(
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
  if (segmentLength < MIN_MOTION_PROFILE_DISTANCE * 2) {
    return getLMCommand(x1, y1, x2, y2, entrySpeed, exitSpeed);
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
      distance >= MIN_COMMAND_DISTANCE &&
      segmentLength - distance >= MIN_COMMAND_DISTANCE &&
      neighborDistance - distance >= MIN_COMMAND_DISTANCE
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
        getLMCommand(lastX, lastY, pointX, pointY, lastSpeed, speed)
      );

      lastX = pointX;
      lastY = pointY;
      lastSpeed = speed;
    }

    // Get the final command
    commands = commands.concat(
      getLMCommand(lastX, lastY, x2, y2, lastSpeed, exitSpeed)
    );

    return commands;
  } else {
    return getLMCommand(x1, y1, x2, y2, entrySpeed, exitSpeed);
  }
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

function getCornerSpeed(
  segmentA,
  segmentB,
  maxSpeed,
  maxLateralAcceleration = 9.81 * 0.8
) {
  const direction1 = segmentA.direction;
  const direction2 = segmentB.direction;

  // Calculate the dot product and determine the angle between the vectors
  const angle = dot(direction1, direction2);
  const theta = Math.acos(angle / (mag(direction1) * mag(direction2)));

  const length = segmentA.length;
  const radius = length / (2 * Math.sin(theta / 2));

  // Calculate cornering speed based on the radius
  const cornerSpeed = Math.sqrt(maxLateralAcceleration * radius);

  return Math.min(cornerSpeed, maxSpeed);
}

export function getLMCommand(x1, y1, x2, y2, entrySpeed, exitSpeed) {
  // https://evil-mad.github.io/EggBot/ebb.html#LM
  const deltaX = INVERT_X_AXIS ? x1 - x2 : x2 - x1;
  const deltaY = INVERT_Y_AXIS ? y1 - y2 : y2 - y1;
  const stepsX = deltaX * STEPS_PER_MM;
  const stepsY = deltaY * STEPS_PER_MM;
  const useMinSpeed = entrySpeed === 0 && exitSpeed === 0;

  const targetEntrySpeed = useMinSpeed ? MIN_MOTION_SPEED : entrySpeed;
  const targetExitSpeed = useMinSpeed ? MIN_MOTION_SPEED : exitSpeed;

  if (Math.round(stepsX) === 0 && Math.round(stepsY) === 0) {
    throw new Error('Invalid LM command input; distance too short');
  }

  const distance = Math.hypot(deltaX, deltaY);
  const timeInitial = distance / targetEntrySpeed;
  const timeFinal = distance / targetExitSpeed;

  const averageSpeed = (targetEntrySpeed + targetExitSpeed) / 2;
  const timeTotal = distance / averageSpeed;

  const commandX = getLMAxis(stepsX, timeInitial, timeFinal, timeTotal);
  const commandY = getLMAxis(stepsY, timeInitial, timeFinal, timeTotal);
  const duration = timeTotal * 1000;

  return [`LM,${commandX},${commandY},3`, duration];
}

function getLMAxis(stepCount, timeInitial, timeFinal, timeTotal) {
  if (stepCount === 0) {
    return '0,0,0';
  }

  const rateInitial = Math.abs(
    Math.round((stepCount / timeInitial) * LM_ACC_PER_SECOND)
  );
  const rateFinal = Math.abs(
    Math.round((stepCount / timeFinal) * LM_ACC_PER_SECOND)
  );

  const rate = Math.round(rateInitial);
  const steps = Math.round(stepCount);
  const acceleration = Math.round(
    (rateFinal - rateInitial) / (timeTotal * CYCLES_PER_SECOND)
  );

  return `${rate},${steps},${acceleration}`;
}

export function getSMCommand(x1, y1, x2, y2, speed) {
  // https://evil-mad.github.io/EggBot/ebb.html#SM
  const deltaX = INVERT_X_AXIS ? x1 - x2 : x2 - x1;
  const deltaY = INVERT_Y_AXIS ? y1 - y2 : y2 - y1;
  const stepsX = Math.round(deltaX * STEPS_PER_MM);
  const stepsY = Math.round(deltaY * STEPS_PER_MM);

  if (stepsX === 0 && stepsY === 0) {
    throw new Error('Invalid SM command input; distance too short');
  }

  const distance = Math.hypot(deltaX, deltaY);
  const timeTotal = distance / (speed === 0 ? MIN_MOTION_SPEED : speed);
  const duration = Math.round(timeTotal * 1000);

  return [`SM,${duration},${stepsX},${stepsY}`, duration];
}
