export type Layer = {
  id: string | undefined;
  paths: Path[];
};

export type Path = number[];

export type Operation = { command: string; duration?: number };

// default attribute prefix for fast-xml-parser is "@_"
export type PolyShape = { '@_points': string };

export type PlotOptions = {
  layerId?: string;
};

export enum PenState {
  DOWN,
  UP,
}

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type StepMode = 1 | 2 | 3 | 4 | 5;

export type PlotterOptions = {
  /** Flag to use virtual mode.
   * If true, plotting will only be simulated.
   * No serial connection will be made and no commands will be sent. */
  isVirtual: boolean;
  /** If true, debug messages will be logged to the console */
  isDebug: boolean;
  /** Machine-related options */
  machine: {
    /** The target serial path to connect to.  If none is given, an attempt will be made to locate an EBB automatically. */
    path: string;
    /** Acceleration options */
    // acceleration: {
    //   /** When the pen is down, time in milliseconds to reach max speed or come to a stop */
    //   rate: number;
    // };
    /** Jerk-related options */
    // jerk: {
    //   /** Enable anti-jerk */
    //   enabled: boolean;
    //   /** The number of future points to evaluate when determining the average direction change */
    //   futureCount: number;
    //   /** The lowest the current speed can be reduced as a percent of stepper down speed */
    //   reduction: number;
    // }
    /** The minimum amount of time in milliseconds that must pass before sending another command */
    // minTravelTime: number;
    /** Time to wait in milliseconds after initialization before beginning an operation */
    // initDuration: number;

    /** Stepper-related options */
    stepper: {
      /** Micro-stepping mode
       * 1: 1/16
       * 2: 1/8
       * 3: 1/4
       * 4: 1/2
       * 5: full step
       */
      stepMode: StepMode;
      /** The step angle in degrees. Default is 1.8deg which comes out to 200 steps per revolution. */
      stepAngle: number;
      /** The pitch of the belt in millimeters.  Default is 2mm to match a GT2 timing belt. */
      beltPitch: number;
      /** The number of teeth on the timing pulleys attached to the stepper motors */
      toothCount: number;
      /** If true, swap the X and Y axes */
      swapAxes: boolean;
      // invertAxes: {
      //   x: boolean;
      //   y: boolean;
      // }
      /** Stepper motor speed settings */
      speed: {
        /** Minimum steps per second */
        min: number;
        /** Maximum steps per second */
        max: number;
        /** Pen up travel speed as a percent between min and max */
        up: number;
        /** Pen down travel speed as a percent between min and max */
        down: number;
      };
    };
    /** Servo-related options */
    servo: {
      /** Amount of time in milliseconds to assume the pen has changed states */
      duration: number;
      /** Servo rate in pulses per channel, 0 for full speed */
      rate: number;
      /** Minimum allowed servo position in units of 83.3 ns intervals */
      min: number;
      /** Maximum allowed servo position in units of 83.3 ns intervals */
      max: number;
      /** Servo up position as a percent between min and max */
      up: number;
      /** Servo down position as a percent between min and max */
      down: number;
    };
    /** Travel limits in millimeters.
     * Default area for the AxiDraw is 300x218mm and default resolution (1/8) is 40 steps/mm.
     */
    limits: {
      x: number;
      y: number;
    };
    // offset: {
    //   x: number;
    //   y: number;
    // }
  };
};
