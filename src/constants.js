export const MICRO_STEP_MODE = {
  1: 16,
  2: 8,
  3: 4,
  4: 2,
  5: 1,
};
export const MOVEMENT_TIME_OFFSET = 50;
export const SKIP_PEN_UP = true;
export const PEN_RADIUS = 0.1;

export const STEP_MODE = 2;
export const STEP_ANGLE = 1.8;
export const BELT_PITCH = 2;
export const PULLEY_TOOTH_COUNT = 20;

// const CYCLES_PER_SECOND = 25_000;
// const LM_ACC_PER_SECOND = (2 ** 31 - 1) / CYCLES_PER_SECOND;

export const SERVO_OPTIONS = {
  rate: 0,
  duration: 300,
  height: {
    min: 9_855,
    max: 27_831,
    up: 40,
    down: 0,
  },
};
export const WORK_AREA_DIMENSIONS = {
  width: 380,
  height: 380,
};
export const STEPS_PER_MM = getStepsPerMM();

export const SEGMENT_OPTIONS = {
  recursion: 8,
  epsilon: 1.1920929e-7,
  pathEpsilon: 0.3,
  angleEpsilon: 0.01,
  angleTolerance: 0,
  cuspLimit: 0,
};

export const OPTIMIZATION_OPTIONS = {
  simplify: {
    mergeDistance: 0.1,
    minPathSize: 1,
    enabled: true,
  },
  randomizeStart: {
    enabled: true,
  },
  sort: {
    enabled: true,
  },
};

function getStepsPerMM() {
  if (!(STEP_MODE in MICRO_STEP_MODE)) {
    throw new Error('Invalid step mode');
  }

  const micro = MICRO_STEP_MODE[STEP_MODE];
  const stepsPerRotation = (360 / STEP_ANGLE) * micro;
  const circumference = BELT_PITCH * PULLEY_TOOTH_COUNT;

  return stepsPerRotation / circumference;
}
