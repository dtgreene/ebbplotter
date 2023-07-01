import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EBB } from './ebb.js';
import { segmentSVG } from './segment/segment.js';
import config from './config.ebb.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ebb = new EBB();

async function main() {
  ebb.on('disconnect', handleDisconnect);

  // await ebb.connect();

  const rabbitPath = resolve(__dirname, './assets/rabbit.svg');
  const rabbit = readFileSync(rabbitPath, 'utf-8');
  const { machineDimensions } = config;
  const segmentOptions = {
    outputWidth: 100,
    machineDimensions,
  };
  const paths = segmentSVG(rabbit, segmentOptions);
  
}

function handleDisconnect() {}

main();
