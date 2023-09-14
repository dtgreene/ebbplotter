import logger from 'loglevel';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareSVG } from './svg/prepare.js';
import { EBB } from './ebb.js';
import {
  LOG_LEVEL,
  WORK_AREA,
  WORK_AREA_TOLERANCE,
  PEN_UP_SPEED,
} from './config.js';
import {
  MotionSegment,
  getMotionCommands,
  getMotionPlan,
} from './motion/motion.js';
import { onProcessExit } from './utils.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ebb = new EBB();

logger.setDefaultLevel(LOG_LEVEL);

let inProgress = true;

async function handleEBBDisconnect() {
  if (inProgress) {
    logger.error('Connection interrupted while operation in progress');
    process.exit(1);
  }
}

onProcessExit(async () => {
  if (ebb.isConnected) {
    try {
      await ebb.disableMotors();
      await ebb.disconnect();
    } catch (error) {
      logger.error(`Could not gracefully shutdown EBB: ${error}`);
    }
  }
});

async function testPlot() {
  await ebb.connect(handleEBBDisconnect);
  await ebb.checkVoltage();
  await ebb.enableMotors();
  await ebb.setupServo();
  await ebb.penUp();

  const svgPath = resolve(__dirname, '../assets/stress.test.svg');
  const svg = readFileSync(svgPath, 'utf-8');
  const { pathList, boundingBox } = prepareSVG(svg, 300);
  const position = { x: 0, y: 0 };

  if (
    boundingBox.minX < -WORK_AREA_TOLERANCE ||
    boundingBox.maxX - WORK_AREA.width > WORK_AREA_TOLERANCE ||
    boundingBox.minY < -WORK_AREA_TOLERANCE ||
    boundingBox.maxY - WORK_AREA.height > WORK_AREA_TOLERANCE
  ) {
    throw new Error('Image bounding box exceeds work area.');
  }

  for (let i = 0; i < pathList.length; i++) {
    await ebb.runCommands(getMotionPlan(pathList[i], position));
  }

  // Return home
  await ebb.runCommands(
    getMotionCommands(
      new MotionSegment(position.x, position.y, 0, 0),
      PEN_UP_SPEED,
      0,
      0
    )
  );

  inProgress = false;

  await ebb.disableMotors();
  await ebb.disconnect();
}

testPlot();
