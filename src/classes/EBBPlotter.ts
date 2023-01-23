import * as path from 'path';
import { ChildProcess, fork } from 'child_process';
import { merge } from 'lodash';

import {
  PlotterOptions,
  PlotOptions,
  RunnerOutMessage,
  RunnerInMessage,
  Layer,
  Operation,
  EBBPlotterOptions,
  PlotterEvent,
} from '../types';
import { debugLog } from '../utils';
import { Emitter } from './Emitter';
import { SVGParser } from './SVGParser';
import { Operator } from './Operator';

// determine runner path
let runnerPath = '';
if (process.env.NODE_ENV === 'dev') {
  runnerPath = path.resolve(__dirname, '../runner.ts');
} else {
  runnerPath = path.resolve(__dirname, '../runner.js');
}

const defaultOptions = {
  isVirtual: false,
  isDebug: false,
  bot: {
    path: '',
    initDuration: 1000,
    disableMotorsOnComplete: true,
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

export class EBBPlotter {
  private inProgress = false;
  private runnerProcess: ChildProcess | null = null;
  private options: PlotterOptions = defaultOptions;
  private emitter: Emitter = new Emitter();
  constructor(options?: Partial<EBBPlotterOptions>) {
    this.options = merge(this.options, options);
    // perform cleanup when the process ends
    process.on('SIGTERM', this.onExit);
    process.on('SIGINT', this.onExit);
  }
  public plot = async (svg: string, plotOptions: Partial<PlotOptions> = {}) => {
    const { isDebug } = this.options;

    // parse incoming svg
    const { layers, dimensions } = SVGParser.parse(svg);

    // log debug messages
    if (isDebug) {
      debugLog(`Layer count: ${layers.length}`);
      debugLog(`SVG dimensions: ${dimensions.width}x${dimensions.height}`);
      layers.forEach((layer, index) => {
        debugLog(`Layer ${index} path count: ${layer.paths.length}`);
      });
    }

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
            .join(', ')}`
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
    const operations = operator.getPlotOperations(plotLayers);

    this.beginOperation(operations);
  };
  public on = (event: PlotterEvent, callback: () => void) => {
    this.emitter.on(event, callback);
  };
  private beginOperation = (operations: Operation[]) => {
    // verify not already in progress
    if (this.inProgress) {
      throw new Error('Operation already in progress');
    }

    // create the runner process
    this.createRunner();
    // indicate in progress
    this.inProgress = true;

    // send plot operation
    this.sendRunnerMessage({ type: 'operations', data: operations });
  };
  private createRunner = () => {
    const { isDebug } = this.options;

    if (this.runnerProcess) {
      throw new Error('Attempted to create multiple runners');
    }

    // create the forked runner process
    this.runnerProcess = fork(
      runnerPath,
      ['-o', JSON.stringify(this.options)],
      {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      }
    );

    // attach debug listeners
    if (isDebug) {
      this.runnerProcess.stdout.on('data', this.createRunnerOutput('RUNNER'));
      this.runnerProcess.stderr.on(
        'data',
        this.createRunnerOutput('RUNNER ERROR')
      );
    }

    this.runnerProcess.on('exit', this.onRunnerExit);
    this.runnerProcess.on('message', this.onRunnerMessage);
  };
  private createRunnerOutput = (prefix: string) => {
    return (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        // multiple logs will be batched together
        message.split('\n').forEach((line) => {
          debugLog(`[${prefix}]: ${line}`);
        });
      }
    };
  };
  private killRunner = () => {
    this.inProgress = false;
    if (this.runnerProcess) {
      this.runnerProcess.kill();
      this.runnerProcess = null;
    }
  };
  private sendRunnerMessage = (message: RunnerInMessage) => {
    if (this.runnerProcess) {
      this.runnerProcess.send(message);
    } else {
      throw new Error('Cannot send runner message; no runner process');
    }
  };
  private onRunnerExit = () => {
    // the runner should be gracefully shut down by this process
    // if an operation is in progress, the runner probably ran into an error
    if (this.inProgress) {
      this.emitter.emit('operationerror', new Error('Runner exited early'));
    }
  };
  private onRunnerMessage = (message: RunnerOutMessage) => {
    const { type } = message;
    switch (type) {
      case 'start': {
        this.emitter.emit('operationstart');
        break;
      }
      case 'finish': {
        this.killRunner();
        this.emitter.emit('operationfinish');
        break;
      }
    }
  };
  private onExit = () => {
    // kill the runner process when this process exits
    this.killRunner();
  };
}
