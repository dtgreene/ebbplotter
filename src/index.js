import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import logger from 'loglevel';
import inquirer from 'inquirer';

import {
  segmentSVG,
  percentBetween,
  pointInBounds,
  distanceTo,
} from './utils.js';
import { SerialController } from './serial.js';
import { Operator } from './operator.js';
import { createPlotPreview } from './preview.js';
import {
  MAX_STEPS_PER_SECOND,
  PLOT_VOLTAGE,
  SERIAL_PATH,
  WORK_AREA_DIMENSIONS,
  STEPS_PER_MM,
  STEPPER_OPTIONS,
  SKIP_PEN_UP,
  PEN_RADIUS,
} from './constants.js';

let inProgress = false;
let position = { x: 0, y: 0 };

// Uncomment for debug messages
// logger.setDefaultLevel('DEBUG');

const serial = new SerialController(SERIAL_PATH, {
  onClose: onPortClose,
});
const operator = new Operator(serial);
const speeds = {
  penUp: percentBetween(
    STEPPER_OPTIONS.speed.min,
    STEPPER_OPTIONS.speed.max,
    STEPPER_OPTIONS.speed.up
  ),
  penDown: percentBetween(
    STEPPER_OPTIONS.speed.min,
    STEPPER_OPTIONS.speed.max,
    STEPPER_OPTIONS.speed.down
  ),
};

const fileOptions = readdirSync('src/assets').filter((file) =>
  file.includes('.svg')
);

const plotQuestions = [
  {
    type: 'list',
    name: 'fileName',
    message: 'Which file would you like to plot?',
    choices: fileOptions,
  },
  {
    type: 'input',
    name: 'plotWidth',
    message: 'Enter the output width of the file in mm',
    default: String(WORK_AREA_DIMENSIONS.width),
    validate: (value) => {
      if (!value) {
        return 'Please enter a value';
      }

      if (isNaN(Number(value))) {
        return 'Please enter a valid number';
      }

      if (Number(value) > WORK_AREA_DIMENSIONS.width) {
        return `Value exceeds work area. Please enter a value less than ${WORK_AREA_DIMENSIONS.width}`;
      }

      return true;
    },
  },
];

async function main() {
  try {
    if (fileOptions.length === 0) {
      exitWithError(
        'No files found! SVG files should be added to the src/assets directory'
      );
    }

    // start the prompt
    const { task } = await inquirer.prompt([
      {
        type: 'list',
        name: 'task',
        message: 'What would you like to do?',
        choices: ['Plot', 'Preview plot', 'Cycle pen', 'Acceleration test'],
      },
    ]);

    switch (task) {
      case 'Plot': {
        await plot();
        break;
      }
      case 'Preview plot': {
        let createCanvas = null;

        try {
          const canvas = await import('canvas');
          createCanvas = canvas.createCanvas;
        } catch (error) {
          exitWithError(
            `Could not import the canvas dependency: ${error}`,
            'For OS-specific installation instructions see https://www.npmjs.com/package/canvas'
          );
        }

        const { fileName, plotWidth } = await inquirer.prompt(plotQuestions);
        const segments = getSegments(fileName, Number(plotWidth));

        await createPlotPreview(createCanvas, segments);
        break;
      }
      case 'Cycle pen': {
        // start the session
        await startSession();
        // perform setup
        await operator.setupServo();

        let direction = await promptDirection();

        // continuously prompt the user for the direction
        while (direction !== 'None') {
          if (direction === 'Up') {
            await operator.penUp();
          } else {
            await operator.penDown();
          }

          direction = await promptDirection();
        }

        // end the session
        await endSession();
        break;
      }
      case 'Acceleration test': {
        break;
      }
      default: {
        exitWithError('Unknown choice');
      }
    }

    // close serial connection
    await serial.close();
  } catch (error) {
    exitWithError(`Operation failed: ${error}`);
  }
}

async function promptDirection() {
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'direction',
      message: 'How would you like to cycle the pen?',
      choices: ['Up', 'Down', 'None'],
    },
  ]);

  return answer.direction;
}

async function plot() {
  const { fileName, plotWidth } = await inquirer.prompt(plotQuestions);
  const segments = getSegments(fileName, Number(plotWidth));

  // start the session
  await startSession();
  // perform setup
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

    // check if it's possible to skip the pen up
    if (SKIP_PEN_UP && segments[i + 1]) {
      // If the start of the next segment is within the pen's radius, we skip
      // the pen up movement.  The idea is that just moving there without raising
      // the pen wouldn't be noticeable.
      if (
        distanceTo(
          segments[i + 1][0],
          segments[i + 1][1],
          position.x,
          position.y
        ) > PEN_RADIUS
      ) {
        await operator.penUp();
      } else {
        logger.debug('Skipping pen up');
      }
    } else {
      await operator.penUp();
    }
  }

  // pen up
  await operator.penUp();
  // return to home when finished
  await moveTo(0, 0, speeds.penUp);
  // end the session
  await endSession();
}

function getSegments(fileName, plotWidth) {
  // verify the file exists
  const filePath = resolve('src/assets', fileName);
  if (!existsSync(filePath)) {
    exitWithError(`File does not exist: ${filePath}`);
  }

  // read the file
  const fileContents = readFileSync(filePath, 'utf-8');
  // segment the svg
  const segments = segmentSVG(fileContents, plotWidth);
  // The third argument is where you would use something like
  // src/constants.js/PATH_SELECTOR to select a path or paths
  // based on stroke, fill, or id.

  if (segments.length === 0) {
    exitWithError(
      'There are no segments to plot! Please check the SVG and your selector if one was provided.'
    );
  }

  return segments;
}

async function startSession(skipVoltageCheck = false) {
  try {
    // indicate progress
    inProgress = true;

    await serial.open();

    if (!skipVoltageCheck) {
      const { current, voltage } = await operator.getMotorCurrent();

      logger.debug(`Motor current: ${current.toFixed(2)}a`);
      logger.debug(`Motor voltage: ${voltage.toFixed(2)}v`);

      if (voltage < PLOT_VOLTAGE) {
        exitWithError(
          `Motor voltage too low: ${voltage}. Is the power supply plugged in?`
        );
      }
    }
  } catch (error) {
    exitWithError(`Could not open serial port: ${error}`);
  }
}

async function endSession() {
  try {
    // indicate progress
    inProgress = false;

    await operator.disableMotors();
    await serial.close();
  } catch (error) {
    exitWithError(`Could not close serial port: ${error}`);
  }
}

async function moveTo(x, y, stepsPS) {
  // check that the requested position is within the travel limits
  if (!pointInBounds(x, y, WORK_AREA_DIMENSIONS)) {
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
  const stepsX = Math.round(deltaX * STEPS_PER_MM);
  const stepsY = Math.round(deltaY * STEPS_PER_MM);

  // calculate duration to travel between points
  const distance = distanceTo(x1, y1, x2, y2);
  const stepDistance = distance * STEPS_PER_MM;
  const duration = Math.round((stepDistance / stepsPS) * 1000);

  // only step for durations over 0, otherwise the board will return an error
  if (duration > 0) {
    await operator.stepMotors(stepsX, stepsY, duration);
  }

  // update position
  position.x = x;
  position.y = y;
}

function exitWithError(...message) {
  logger.error(...message);
  process.exit(1);
}

function onPortClose() {
  if (inProgress) {
    exitWithError('Lost serial connection while in progress');
  }
}

main();
