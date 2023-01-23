import { test } from 'node:test';
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import Plotter from '../../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Not a full integration test but a way to test functionality when developing */
test('plot', async () => {
  const svgPath = resolve(__dirname, './smiley_processed.svg');
  const svg = fs.readFileSync(svgPath, 'utf-8').toString();

  const plotter = new Plotter({
    machine: { limits: { x: 300, y: 300 } },
    isDebug: true,
    isVirtual: true,
  });

  console.log('Test plot starting');
  await plotter.plot(svg);
  console.log('Test plot finished');
});
