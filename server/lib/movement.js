import { Config } from './config.js';

const CYCLES_PER_SECOND = 25_000;
const LM_ACC_PER_SECOND = 2 ** 31 / CYCLES_PER_SECOND;

export function getLMCommand(x1, y1, x2, y2, entrySpeed, exitSpeed) {
  const { deltaX, deltaY, stepsX, stepsY } = getSteps(x1, y1, x2, y2);

  if (entrySpeed === 0 && exitSpeed === 0) {
    throw new Error(
      'Invalid LM command input; entry and exit speeds cannot both be zero',
    );
  }

  if (stepsX === 0 && stepsY === 0) {
    throw new Error('Invalid LM command input; distance too short');
  }

  const rateInitial = entrySpeed * LM_ACC_PER_SECOND;
  const rateFinal = exitSpeed * LM_ACC_PER_SECOND;
  const averageSpeed = (entrySpeed + exitSpeed) * 0.5;

  const commandX = getLMAxis(stepsX, averageSpeed, rateInitial, rateFinal);
  const commandY = getLMAxis(stepsY, averageSpeed, rateInitial, rateFinal);
  const duration = getDuration(Math.hypot(deltaX, deltaY) / averageSpeed);

  return [`LM,${commandX},${commandY},3`, duration];
}

export function getSMCommand(x1, y1, x2, y2, speed) {
  const { deltaX, deltaY, stepsX, stepsY } = getSteps(x1, y1, x2, y2);

  if (speed === 0) {
    throw new Error('Invalid SM command input; speed cannot be zero');
  }

  if (stepsX === 0 && stepsY === 0) {
    throw new Error('Invalid SM command input; distance too short');
  }

  const duration = getDuration(Math.hypot(deltaX, deltaY) / speed);

  return [`SM,${Math.round(duration)},${stepsX},${stepsY}`, duration];
}

function getSteps(x1, y1, x2, y2) {
  const { STEPS_PER_MM } = Config.STEPPER;
  const { INVERT_X, INVERT_Y, CORE_XY } = Config;

  const deltaX = INVERT_X ? x1 - x2 : x2 - x1;
  const deltaY = INVERT_Y ? y1 - y2 : y2 - y1;

  if (CORE_XY) {
    return {
      deltaX,
      deltaY,
      stepsX: Math.round((deltaX + deltaY) * stepsPerMM),
      stepsY: Math.round((deltaX - deltaY) * STEPS_PER_MM),
    };
  } else {
    return {
      deltaX,
      deltaY,
      stepsX: Math.round(deltaX * STEPS_PER_MM),
      stepsY: Math.round(deltaY * STEPS_PER_MM),
    };
  }
}

function getLMAxis(steps, averageSpeed, rateInitial, rateFinal) {
  if (steps === 0) {
    return '0,0,0';
  }

  const time = steps / averageSpeed;
  const intervals = time * CYCLES_PER_SECOND;
  const acceleration = (rateFinal - rateInitial) / intervals;

  return `${Math.round(rateInitial)},${steps},${Math.round(acceleration)}`;
}

function getDuration(movementSeconds) {
  const duration = movementSeconds * 1000;

  if (duration > 50) {
    return duration - 30;
  }

  return duration;
}
