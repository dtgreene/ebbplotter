export const Config = {
  PLANNER: {
    ACCELERATION: 1200,
    CORNER_FACTOR: 0.001,
  },
  STEPPER: {
    UP_SPEED: 300,
    DOWN_SPEED: 200,
    // See: https://evil-mad.github.io/EggBot/ebb.html#EM
    MODE: 2,
    MIN_COMMAND_DISTANCE: 0.025,
    STEPS_PER_MM: 40,
  },
  SERVO: {
    // See: https://evil-mad.github.io/EggBot/ebb.html#SC
    MIN: 10_000,
    MAX: 17_000,
    DURATION: 300,
    RATE: 0,
  },
  INVERT_X: false,
  INVERT_Y: false,
  CORE_XY: false,
};
