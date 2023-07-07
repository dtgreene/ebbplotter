import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from 'loglevel';

import { EBB } from './ebb.js';
import config from './config.ebb.js';
import { getVectorSegments } from './segment/segment.js';
import { createMotionPlan } from './motion.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ebb = new EBB();

logger.setDefaultLevel('DEBUG');

async function main() {
  ebb.on('disconnect', handleDisconnect);

  try {
    await ebb.connect();
  } catch (error) {
    logger.error(`Could not connect: ${error}`);
    process.exit(1);
  }

  if (!(await ebb.checkMotorVoltage())) {
    await ebb.disconnect();
    logger.error('Voltage check failed; Is the board plugged in?');
    process.exit(1);
  }

  await ebb.setupServo();
  await ebb.enableMotors();
  await ebb.penUp();

  // move

  await ebb.disconnect();

  // const rabbitPath = resolve(__dirname, './assets/rabbit.svg');
  // const rabbit = readFileSync(rabbitPath, 'utf-8');
  // const segmentOptions = { outputWidth: 100 };
  // const segments = getVectorSegments(rabbit, segmentOptions);

  // createMotionPlan(segments);
}

function handleDisconnect() {}

main();
