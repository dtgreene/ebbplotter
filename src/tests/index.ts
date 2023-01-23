import { test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';

import { EBBPlotter } from '../classes/EBBPlotter';

/** Not a full integration test suite but a way to test basic functionality when developing */
test('plot', async () => {
  const svgPath = path.resolve(__dirname, './smiley_processed.svg');
  const svg = fs.readFileSync(svgPath, 'utf-8').toString();

  const plotter = new EBBPlotter({
    bot: { limits: { x: 300, y: 300 } },
    isDebug: true,
    isVirtual: true,
  });

  console.log('Test plot starting');
  await plotter.plot(svg);
  console.log('Test plot finished');
});
