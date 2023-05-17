export const MICRO_STEP_MODE = {
  1: 16,
  2: 8,
  3: 4,
  4: 2,
  5: 1,
};
export const PLOT_VOLTAGE = 250;
export const BAUD_RATE = 9600;
export const RESPONSE_ACK = 'OK';
export const BOARD_VENDOR_ID = 1240;
export const BOARD_PRODUCT_ID = 64914;
export const BOARD_NAME = 'EiBotBoard';
export const BOARD_MANUFACTURER = 'SchmalzHaus';
export const MAX_STEPS_PER_SECOND = 25000;
export const PLOT_OPTIONS = {
  isVirtual: false,
  isDebug: true,
  machine: {
    path: '',
    stepper: {
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
    },
    dimensions: {
      width: 300,
      height: 218,
    },
    servo: {
      duration: 500,
      rate: 0,
      min: 9855,
      max: 27831,
      up: 70,
      down: 30,
    },
  },
};
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
