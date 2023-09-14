// See:
// https://github.com/mattdesl/adaptive-bezier-curve/blob/master/function.js#L12-L18
export const PATH_BEZIER_OPTIONS = {
  recursion: 8,
  pathEpsilon: 0.1,
};

export const PATH_MERGE = true;
export const PATH_RANDOMIZE_START = false;

export const PATH_MERGE_DISTANCE = 0.1;

// See: https://evil-mad.github.io/EggBot/ebb.html#EM
export const STEP_MODE = 2;
// See: https://evil-mad.github.io/EggBot/ebb.html#SC
export const SERVO_MIN_POSITION = 10_000;
export const SERVO_MAX_POSITION = 17_000;
export const SERVO_RATE = 0;
// The number of steps needed to move one millimeter. See the function below to
// calculate new values;
export const STEPS_PER_MM = 40;
export const MIN_COMMAND_DISTANCE = 1 / STEPS_PER_MM;
// The time the servo takes to change from one state to another; in ms
export const SERVO_DURATION = 300;
// Travel speed when the pen is down; in mm/s
export const PEN_DOWN_SPEED = 250;
// Travel speed when the pen is up; in mm/s
export const PEN_UP_SPEED = 300;
// The shortest distance an individual motion profile leg can be. Shorter legs
// are discarded. Must be greater than the minimum command distance.
export const MIN_MOTION_PROFILE_DISTANCE = 0.4;
export const MIN_MOTION_DELTA_TOLERANCE = 0.01;
export const MIN_MOTION_SPEED = 20;
// Acceleration used for motion planning; in mm/s ^ 2
export const MOTION_ACCELERATION = 1200;
export const MOTION_CORNER_FACTOR = 32;
export const MOTOR_VOLTAGE_MIN = 8;

// The dimensions of the work area; in mm
export const WORK_AREA = { width: 380, height: 380 };
export const WORK_AREA_TOLERANCE = 0.1;

export const INVERT_X_AXIS = false;
export const INVERT_Y_AXIS = false;

export const LOG_LEVEL = 'DEBUG';

function getStepsPerMM(stepMode) {
  const MICRO_STEP_MODE = {
    1: 16,
    2: 8,
    3: 4,
    4: 2,
    5: 1,
  };

  if (!(stepMode in MICRO_STEP_MODE)) {
    throw new Error('Invalid step mode');
  }
  // In degrees
  const stepAngle = 1.8;
  // In mm
  const beltPitch = 2;
  const pulleyToothCount = 20;

  const micro = MICRO_STEP_MODE[stepMode];
  const stepsPerRotation = (360 / stepAngle) * micro;
  const circumference = beltPitch * pulleyToothCount;

  return stepsPerRotation / circumference;
}
