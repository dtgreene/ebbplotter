import merge from 'lodash.merge';
import logger from 'loglevel';

import { PlotterOptions, PlotOptions, RecursivePartial } from '../types';
import { SVGParser } from './SVGParser';
import { Operator } from './Operator';
import {
  getStepsPerMM,
  percentBetween,
  distanceTo,
  pointInBounds,
} from '../utils';
import { maxStepsPS } from '../constants';
import { SerialController } from './SerialController';

const defaultOptions = {
  isVirtual: false,
  isDebug: false,
  machine: {
    path: '',
    stepper: {
      stepMode: 2 as const,
      stepAngle: 1.8,
      beltPitch: 2,
      toothCount: 20,
      swapAxes: false,
      speed: {
        min: 200,
        max: 5000,
        up: 60,
        down: 80,
      },
    },
    limits: {
      x: 300,
      y: 218,
    },
    servo: {
      duration: 1000,
      rate: 0,
      min: 9855,
      max: 27831,
      up: 70,
      down: 30,
    },
  },
};

export default class Plotter {
  private options: PlotterOptions = defaultOptions;
  private serial: SerialController;
  private operator: Operator;
  private inProgress = false;
  private units = {
    stepsPerMM: 0,
  };
  private speeds = {
    penUp: 0,
    penDown: 0,
  };
  private position = {
    x: 0,
    y: 0,
  };
  constructor(options?: Partial<RecursivePartial<PlotterOptions>>) {
    this.options = merge(this.options, options);
    this.serial = new SerialController(this.options.machine.path, {
      isVirtual: this.options.isVirtual,
      onClose: this.onPortClose,
    });
    this.operator = new Operator(this.serial, this.options);
    // pre-calculate some values for use later
    const { stepper } = this.options.machine;

    // steps per mm
    this.units = {
      stepsPerMM: getStepsPerMM(stepper),
    };

    // pen up speed in steps per second
    this.speeds = {
      penUp: percentBetween(
        stepper.speed.min,
        stepper.speed.max,
        stepper.speed.up,
      ),
      penDown: percentBetween(
        stepper.speed.min,
        stepper.speed.max,
        stepper.speed.down,
      ),
    };

    if (this.options.isDebug) {
      logger.setDefaultLevel('debug');
    }
  }
  public plot = async (svg: string, plotOptions: Partial<PlotOptions> = {}) => {
    // get plot layers
    const { plotLayers, dimensions } = SVGParser.getPlotLayers(
      svg,
      plotOptions.layerId,
    );

    // check travel limits
    const { machine } = this.options;
    if (!pointInBounds(dimensions.width, dimensions.height, machine)) {
      throw new Error('SVG dimensions exceed travel limits');
    }

    // open connection
    await this.open();
    // set progress
    this.inProgress = true;

    // check motor voltage
    if (!this.options.isVirtual) {
      const motorVoltage = await this.operator.getMotorVoltage();
      // should be 300 when plugged in but there could be some variance
      if (motorVoltage < 250) {
        throw new Error(
          `Motor voltage too low: ${motorVoltage}. Is the power supply plugged in?`,
        );
      }
    }

    // get ready for plotting
    await this.operator.enableMotors();
    await this.operator.setupServo();
    await this.operator.penUp();

    // all layers and paths will be converted and flattened into a single array of operations
    for (let i = 0; i < plotLayers.length; i++) {
      const { paths } = plotLayers[i];
      for (let j = 0; j < paths.length; j++) {
        const path = paths[j];
        for (let k = 0; k < path.length; k += 2) {
          const x = path[k];
          const y = path[k + 1];

          if (k === 0) {
            // the pen should be up when moving to the first point
            await this.moveTo(x, y, this.speeds.penUp);
            // lower the pen after reaching the first point
            await this.operator.penDown();
          } else {
            // otherwise, move at down speed
            await this.moveTo(x, y, this.speeds.penDown);
          }
        }
        // return to the first point
        await this.moveTo(path[0], path[1], this.speeds.penDown);
        // after completing the path, the pen needs to be raised
        await this.operator.penUp();
      }
    }

    // return to home when done
    await this.moveTo(0, 0, this.speeds.penUp);
    // disable motors
    await this.operator.disableMotors();

    // set progress
    this.inProgress = false;
  };
  public moveTo = async (x: number, y: number, stepsPS: number) => {
    const { machine } = this.options;

    // check that the requested position is within the travel limits
    if (!pointInBounds(x, y, machine)) {
      throw new Error('Movement exceeds travel limits');
    }

    // verify the maximum steps per second isn't being exceeded
    if (stepsPS > maxStepsPS) {
      throw new Error(
        'Max steps per second exceeded.  Should not be greater than 25,000',
      );
    }

    const x1 = x;
    const y1 = y;
    const x2 = this.position.x;
    const y2 = this.position.y;

    // calculate steps to take in each direction
    const deltaX = x1 - x2;
    const deltaY = y1 - y2;
    const stepsX = Math.round(deltaX * this.units.stepsPerMM);
    const stepsY = Math.round(deltaY * this.units.stepsPerMM);

    // calculate duration to travel between points
    const distance = distanceTo(x1, y1, x2, y2);
    const stepDistance = distance * this.units.stepsPerMM;
    const duration = Math.round((stepDistance / stepsPS) * 1000);

    if (!machine.stepper.swapAxes) {
      await this.operator.stepMotors(stepsX, stepsY, duration);
    } else {
      await this.operator.stepMotors(stepsY, stepsX, duration);
    }

    // update position
    this.position.x = x;
    this.position.y = y;
  };
  public isConnected = () => {
    return this.serial.isConnected;
  };
  public close = async () => {
    // check if in progress
    if (this.inProgress) {
      this.inProgress = false;
      logger.error('Closing connection while in progress');
    }

    try {
      await this.serial.close();
    } catch (e) {
      throw new Error(`Could not close serial connection: ${e}`);
    }
  };
  public open = async () => {
    try {
      await this.serial.open();
    } catch (e) {
      throw new Error(`Could not open serial connection: ${e}`);
    }
  };
  private onPortClose = () => {
    if (this.inProgress) {
      throw new Error('Lost serial connection');
    }
  };
}
