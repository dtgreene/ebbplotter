import { merge } from 'lodash';
import logger from 'loglevel';

import {
  PlotterOptions,
  PlotOptions,
  Layer,
  Operation,
  RecursivePartial,
} from '../types';
import { SVGParser } from './SVGParser';
import { Operator } from './Operator';
import { SerialController } from './SerialController';

const defaultOptions = {
  isVirtual: false,
  isDebug: false,
  bot: {
    path: '',
    initDuration: 1000,
    disableMotorsOnFinish: true,
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
      invert: false,
    },
  },
};

export default class Plotter {
  private inProgress = false;
  private operations: Operation[] = [];
  private options: PlotterOptions = defaultOptions;
  private serial: SerialController;
  constructor(options?: Partial<RecursivePartial<PlotterOptions>>) {
    this.options = merge(this.options, options);
    this.serial = new SerialController(this.options.bot.path, {
      isVirtual: this.options.isVirtual,
    });

    if (this.options.isDebug) {
      logger.setDefaultLevel('debug');
    }
  }
  public plot = (svg: string, plotOptions: Partial<PlotOptions> = {}) => {
    // parse incoming svg
    const { layers, dimensions } = SVGParser.parse(svg);

    // log debug messages
    logger.debug(`Layer count: ${layers.length}`);
    logger.debug(`SVG dimensions: ${dimensions.width}x${dimensions.height}`);
    layers.forEach((layer, index) => {
      logger.debug(`Layer ${index} path count: ${layer.paths.length}`);
    });

    // check travel limits
    const {
      bot: { stepper, limits },
    } = this.options;

    if (!stepper.swapAxes) {
      if (dimensions.width > limits.x || dimensions.height > limits.y) {
        throw new Error('SVG exceeds travel limits');
      }
    } else {
      if (dimensions.width > limits.y || dimensions.height > limits.x) {
        throw new Error('SVG exceeds travel limits');
      }
    }

    // determine plot layers
    const { layerId } = plotOptions;
    // the layers to plot
    let plotLayers: Layer[] = [];

    if (layerId) {
      // if a layer id is given, try to find that layer
      const foundLayer = layers.find((layer) => layer.id === layerId);
      if (foundLayer) {
        plotLayers = [foundLayer];
      } else {
        throw new Error(
          `Could not find specified layer id: ${layerId}; Available layers: ${layers
            .map(({ id }) => id)
            .join(', ')}`,
        );
      }
    } else {
      // otherwise, just use all layers found
      plotLayers = layers;
    }

    // verify there are layers to plot
    if (plotLayers.length === 0) {
      throw new Error('No layers to plot');
    }

    const operator = new Operator(this.options);
    this.operations = operator.getPlotOperations(plotLayers);

    return this.startOperations();
  };
  private startOperations = async () => {
    // verify not already in progress
    if (this.inProgress) {
      throw new Error('Operation already in progress');
    }

    // indicate in progress
    this.inProgress = true;

    try {
      await this.serial.connect();
    } catch (e) {
      throw new Error(`Serial controller failed to connect: ${e}`);
    }

    for (let i = 0; i < this.operations.length; i++) {
      const { command, duration = 0 } = this.operations[i];

      try {
        await this.serial.write(command);
      } catch (e) {
        logger.error(`Serial controller failed to write: ${e}`);
      }

      await new Promise((res) => setTimeout(res, duration));
    }
  };
}
