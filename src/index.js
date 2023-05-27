import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import prompt from 'prompt';
import logger from 'loglevel';

import {
  getStepsPerMM,
  segmentSVG,
  percentBetween,
  pointInBounds,
  distanceTo,
} from './utils.js';
import { SerialController } from './serial.js';
import { Operator } from './operator.js';
import {
  MAX_STEPS_PER_SECOND,
  PLOT_OPTIONS,
  PLOT_VOLTAGE,
} from './constants.js';

let inProgress = false;
let position = { x: 0, y: 0 };

const promptSchema = {
  properties: {
    fileName: {
      message: 'Enter the name of the file to plot',
      required: true,
    },
    plotWidth: {
      message: 'Enter the output width of the file in mm',
      required: true,
    },
  },
};

const serial = new SerialController(PLOT_OPTIONS.machine.path, {
  isVirtual: PLOT_OPTIONS.isVirtual,
  onClose: onPortClose,
});
const operator = new Operator(serial, PLOT_OPTIONS);

const { stepper } = PLOT_OPTIONS.machine;
const stepsPerMM = getStepsPerMM(stepper);
const speeds = {
  penUp: percentBetween(stepper.speed.min, stepper.speed.max, stepper.speed.up),
  penDown: percentBetween(
    stepper.speed.min,
    stepper.speed.max,
    stepper.speed.down
  ),
};

async function main() {
  try {
    if (PLOT_OPTIONS.isDebug) {
      // enable debug logging
      logger.setDefaultLevel('debug');
    }

    // start the prompt service
    prompt.start();

    // prompt the name of the file to plot
    const { fileName, plotWidth } = await prompt.get(promptSchema);

    // verify the file exists
    const filePath = resolve('src/assets', fileName);
    if (!existsSync(filePath)) {
      exitWithError(`File does not exist: ${filePath}`);
    }

    // read the file
    const fileContents = readFileSync(filePath, 'utf-8');
    // segment the svg
    const segments = segmentSVG(
      fileContents,
      plotWidth,
      (path) => path.id === 'layer1'
    );

    // open serial port connection
    try {
      await serial.open();
    } catch (error) {
      exitWithError(`Could not open serial port: ${error}`);
    }

    // check motor voltage
    if (!PLOT_OPTIONS.isVirtual) {
      const motorVoltage = await operator.getMotorVoltage();

      if (motorVoltage < PLOT_VOLTAGE) {
        exitWithError(
          `Motor voltage too low: ${motorVoltage}. Is the power supply plugged in?`
        );
      }
    }

    // indicate plotting has begun
    inProgress = true;

    await operator.enableMotors();
    await operator.setupServo();
    await operator.penUp();

    for (let i = 0; i < segments.length; i++) {
      logger.debug(`Starting path ${i}/${segments.length}`);

      // move to the first position
      await moveTo(segments[i][0], segments[i][1], speeds.penUp);

      // pen down
      await operator.penDown();

      // start at the second position
      for (let j = 2; j < segments[i].length; j += 2) {
        const x = segments[i][j];
        const y = segments[i][j + 1];

        await moveTo(x, y, speeds.penDown);
      }

      // if there is another segment to plot
      if (segments[i + 1]) {
        const xDiff = Math.abs(segments[i + 1][0] - position.x);
        const yDiff = Math.abs(segments[i + 1][1] - position.y);

        // only pen up if the start of the next segment is some distance away
        if (xDiff > 0.01 || yDiff > 0.01) {
          await operator.penUp();
        } else {
          logger.debug('Skipping pen up');
        }
      } else {
        await operator.penUp();
      }
    }

    // return to home when finished
    await moveTo(0, 0, speeds.penUp);
    
    // indicate plotting has finished
    inProgress = false;

    // close serial connection
    await serial.close();
  } catch (error) {
    exitWithError(`Plotting failed: ${error}`);
  }
}

async function moveTo(x, y, stepsPS) {
  // check that the requested position is within the travel limits
  if (!pointInBounds(x, y, PLOT_OPTIONS.machine.dimensions)) {
    exitWithError('Attempted to move outside of travel limits');
  }

  // verify the maximum steps per second isn't being exceeded
  if (stepsPS > MAX_STEPS_PER_SECOND) {
    exitWithError(
      `Max steps per second exceeded.  Should not be greater than ${MAX_STEPS_PER_SECOND.toLocaleString()}`
    );
  }

  const x1 = position.x;
  const y1 = position.y;
  const x2 = x;
  const y2 = y;

  // calculate steps to take in each direction
  const deltaX = x1 - x2;
  const deltaY = y1 - y2;
  const stepsX = Math.round(deltaX * stepsPerMM);
  const stepsY = Math.round(deltaY * stepsPerMM);

  // calculate duration to travel between points
  const distance = distanceTo(x1, y1, x2, y2);
  const stepDistance = distance * stepsPerMM;
  const duration = Math.round((stepDistance / stepsPS) * 1000);

  // only step for durations over 0, otherwise the board will return an error
  if (duration > 0) {
    await operator.stepMotors(stepsX, stepsY, duration);
  }

  // update position
  position.x = x;
  position.y = y;
}

function exitWithError(message) {
  logger.error(message);
  process.exit(1);
}

function onPortClose() {
  if (inProgress) {
    exitWithError('Lost serial connection while in progress');
  }
}

main();
