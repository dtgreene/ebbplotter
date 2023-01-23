import { flatten } from 'lodash';
import logger from 'loglevel';

import { Operation, PlotterOptions, Layer } from '../types';
import { distanceTo, percentBetween } from '../utils';

// map of the micro step modes to the micro step values
const MicroSteps = {
  1: 16,
  2: 8,
  3: 4,
  4: 2,
  5: 1,
};

export class Operator {
  private options: PlotterOptions;
  private stepsPerMM: number;
  private penUpSpeed: number;
  private penDownSpeed: number;
  private position = { x: 0, y: 0 };
  constructor(options: PlotterOptions) {
    this.options = options;

    // pre-calculate some values for use later
    const {
      bot: { stepper },
    } = this.options;

    // steps per mm
    this.stepsPerMM = this.getStepsPerMM();

    // pen up speed in steps per second
    this.penUpSpeed = percentBetween(
      stepper.speed.min,
      stepper.speed.max,
      stepper.speed.up,
    );

    // pen down speed in steps per second
    this.penDownSpeed = percentBetween(
      stepper.speed.min,
      stepper.speed.max,
      stepper.speed.down,
    );
  }
  public getPlotOperations = (layers: Layer[]) => {
    const {
      bot: { servo },
    } = this.options;

    // debug logging
    logger.debug(`Steps per mm: ${this.stepsPerMM}`);

    // the initial operations
    const operations: Operation[] = [];

    // create the pen operations
    const raisePen = { command: 'SP,0', duration: servo.duration };
    const lowerPen = { command: 'SP,1', duration: servo.duration };

    // all layers and movements are stored in a flat array
    layers.forEach(({ paths }) => {
      paths.forEach((path) => {
        for (let i = 0; i < path.length; i += 2) {
          const x = path[i];
          const y = path[i + 1];

          const speed = i === 0 ? this.penUpSpeed : this.penDownSpeed;
          operations.push(this.getMoveOperation(x, y, speed));

          // update position
          this.position.x = x;
          this.position.y = y;

          // after moving to the first position, the pen needs to be lowered
          if (i === 0) {
            operations.push(lowerPen);
          }
        }
        // after completing a movement, the pen needs to be raised
        operations.push(raisePen);
      });
    });

    // debug logging
    logger.debug(`Total plot operations: ${operations.length}`);

    return flatten([
      this.getStartOperations(),
      operations,
      this.getEndOperations(),
    ]);
  };
  public getTestOperations = () => {
    const {
      bot: { servo },
    } = this.options;

    // debug logging
    logger.debug(`Steps per mm: ${this.stepsPerMM}`);
    logger.debug(`Servo rate: ${servo.rate}`);
    logger.debug(`Servo duration: ${servo.duration}`);

    const operations: Operation[] = [
      this.getMoveOperation(50, 50, this.penUpSpeed),
    ];

    this.position.x = 50;
    this.position.y = 50;

    return flatten([
      this.getStartOperations(),
      operations,
      this.getEndOperations(),
    ]);
  };
  private getStartOperations = () => {
    const {
      bot: { initDuration, stepper, servo },
    } = this.options;

    // servo settings
    const servoMin = Math.round(
      percentBetween(servo.min, servo.max, servo.down),
    );
    const servoMax = Math.round(percentBetween(servo.min, servo.max, servo.up));

    // the final operation
    return [
      // enable motors
      { command: `EM,${stepper.stepMode}` },
      // set servo rate
      { command: `SC,10,${servo.rate}` },
      // set servo min
      {
        command: `SC,4,${Math.round(servoMin)}`,
      },
      // set servo max
      {
        command: `SC,5,${Math.round(servoMax)}`,
      },
      // set pen state up
      { command: 'SP,0', duration: servo.duration },
      // additional wait time for the above setup to complete
      { command: `SM,${initDuration},0,0`, duration: initDuration },
    ];
  };
  private getEndOperations = () => {
    const {
      bot: { disableMotorsOnComplete },
    } = this.options;

    const operations: Operation[] = [];

    // return to home
    if (this.position.x !== 0 || this.position.y !== 0) {
      operations.push(this.getMoveOperation(0, 0, this.penUpSpeed));
    }

    // disable motors
    if (disableMotorsOnComplete) {
      operations.push({ command: 'EM,0,0', duration: 1000 });
    }

    return operations;
  };
  private getMoveOperation = (x: number, y: number, stepsPerSecond: number) => {
    const { bot } = this.options;
    const { swapAxes } = bot.stepper;

    const x1 = x;
    const y1 = y;
    const x2 = this.position.x;
    const y2 = this.position.y;

    // distance in millimeters
    const distance = distanceTo(x1, y1, x2, y2);
    // distance in steps
    const stepDistance = distance * this.stepsPerMM;
    const duration = Math.round((stepDistance / stepsPerSecond) * 1000);

    const deltaX = x1 - x2;
    const deltaY = y1 - y2;

    const stepsX = Math.round(deltaX * this.stepsPerMM);
    const stepsY = Math.round(deltaY * this.stepsPerMM);

    if (!swapAxes) {
      return {
        command: `SM,${duration},${stepsX},${stepsY}`,
        duration,
      };
    } else {
      return {
        command: `SM,${duration},${stepsY},${stepsX}`,
        duration,
      };
    }
  };
  private getStepsPerMM = () => {
    const { bot } = this.options;
    const { stepMode, stepAngle, beltPitch, toothCount } = bot.stepper;

    const microSteps = MicroSteps[stepMode];
    const stepsPerMM =
      ((360 / stepAngle) * microSteps) / (beltPitch * toothCount);

    return Math.round(stepsPerMM);
  };
}
