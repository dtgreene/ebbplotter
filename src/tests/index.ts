import { test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';

import Plotter from '../classes/Plotter';

test('plot', async () => {
  const svgPath = path.resolve(__dirname, './smiley_processed.svg');
  const svg = fs.readFileSync(svgPath, 'utf-8').toString();

  const plotter = new Plotter({
    bot: { limits: { x: 300, y: 300 } },
    isDebug: true,
    isVirtual: true,
  });

  console.log('Test plot starting');
  await plotter.plot(svg);
  console.log('Test plot finished');
});
