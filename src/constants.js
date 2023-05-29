export const MICRO_STEP_MODE = {
  1: 16,
  2: 8,
  3: 4,
  4: 2,
  5: 1,
};
export const PLOT_VOLTAGE = 250;
export const BAUD_RATE = 9600;
export const SERIAL_PATH = '';
export const RESPONSE_ACK = 'OK';
export const BOARD_VENDOR_ID = 1240;
export const BOARD_PRODUCT_ID = 64914;
export const BOARD_NAME = 'EiBotBoard';
export const BOARD_MANUFACTURER = 'SchmalzHaus';
export const MAX_STEPS_PER_SECOND = 25000;
export const READ_WRITE_TIMEOUT = 5000;
export const STEPPER_OPTIONS = {
  stepMode: 2,
  stepAngle: 1.8,
  beltPitch: 2,
  toothCount: 20,
  speed: {
    min: 200,
    max: 5000,
    up: 30,
    down: 20,
  },
};
export const SERVO_OPTIONS = {
  duration: 500,
  rate: 0,
  height: {
    min: 9855,
    max: 27831,
    up: 40,
    down: 0,
  },
};
export const WORK_AREA_DIMENSIONS = {
  width: 380,
  height: 380,
};
export const STEPS_PER_MM = getStepsPerMM();
export const IS_VIRTUAL = false;

// see https://www.npmjs.com/package/loglevel for more info
export const LOG_LEVEL = 'debug';

export const SEGMENT_OPTIONS = {
  recursion: 8,
  epsilon: 1.1920929e-7,
  pathEpsilon: 0.5,
  angleEpsilon: 0.01,
  angleTolerance: 0,
  cuspLimit: 0,
  round: {
    precision: 4,
  },
  simplify: {
    mergeDistance: 0.1,
    minPathSize: 1,
  },
};
export const PATH_SELECTOR = (path) => path.id === 'layer1';
export const PEN_DIAMETER = 0.5;

function getStepsPerMM() {
  const { stepMode, stepAngle, beltPitch, toothCount } = STEPPER_OPTIONS;

  if (!(stepMode in MICRO_STEP_MODE)) {
    throw new Error('Invalid step mode');
  }

  const micro = MICRO_STEP_MODE[stepMode];
  const steps = ((360 / stepAngle) * micro) / (beltPitch * toothCount);

  return Math.round(steps);
}
