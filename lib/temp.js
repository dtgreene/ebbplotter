import logger from 'loglevel';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareSVG } from './svg/prepare.js';
// import { openPreview } from './preview.js';
import { EBB } from './ebb.js';
import { LOG_LEVEL, WORK_AREA, WORK_AREA_TOLERANCE } from './config.js';
import { getMotionPlan } from './motion.js';
import { wait } from './utils.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ebb = new EBB();

logger.setDefaultLevel(LOG_LEVEL);

/*
async function main() {
  const svgPath = resolve(__dirname, '../assets/leaves.test.svg');
  const svg = readFileSync(svgPath, 'utf-8');
  const { pathList } = prepareSVG(svg, 200);

  const position = { x: 0, y: 0 };
  for (let i = 0; i < pathList.length; i++) {
    const commands = getMotionPlan(pathList[i], position);
    console.log(commands);
    break;
  }
  // openPreview(result);
}
main();
*/

async function testPlot() {
  let inProgress = true;

  const onDisconnect = async () => {
    if (inProgress) {
      logger.error('Connection interrupted');
      process.exit(1);
    }
  };

  await ebb.connect(onDisconnect);
  await ebb.checkVoltage();
  await ebb.enableMotors();
  await ebb.setupServo();
  await ebb.penUp();

  const svgPath = resolve(__dirname, '../assets/rabbit.test.svg');
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
    const commands = getMotionPlan(pathList[i], position);
    for (let j = 0; j < commands.length; j += 2) {
      const command = commands[j];
      const duration = commands[j + 1];

      await ebb.write(command);

      if (duration > 30) {
        await wait(duration);
      }
    }
    break;
  }

  inProgress = false;

  await ebb.disableMotors();
  await ebb.disconnect();
}

testPlot();
