export default {
  stepper: {
    stepMode: 2,
    stepAngle: 1.8,
    beltPitch: 2,
    pulleyToothCount: 20,
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
    down: 20,
    // In mm per second
    up: 50,
    // In mm per second^2
    acceleration: 5,
  },
};
