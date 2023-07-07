export default {
  stepper: {
    stepMode: 2,
    stepsPerMM: 40,
  },
  servo: {
    min: 10_000,
    max: 17_000,
    rate: 0,
    duration: 300,
  },
  machineDimensions: {
    width: 380,
    height: 380,
  },
  penRadius: 0.2,
  segment: {
    bezierOptions: {
      recursion: 8,
      epsilon: 1.1920929e-7,
      pathEpsilon: 0.3,
      angleEpsilon: 0.01,
      angleTolerance: 0,
      cuspLimit: 0,
    },
    optimizations: {
      simplify: {},
      randomizeStart: {},
      sort: {},
    },
  },
  speeds: {
    // In mm per second
    down: 100,
    // In mm per second
    up: 200,
    // In mm per second^2
    acceleration: 5,
    cornerFactor: 0.2,
  },
};

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
