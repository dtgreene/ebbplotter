import { test } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';

import { EBBPlotter } from '../classes/EBBPlotter';

test('plot', () => {
  const svgPath = path.resolve(__dirname, './smiley_processed.svg');
  const svg = fs.readFileSync(svgPath, 'utf-8').toString();

  const plotter = new EBBPlotter({
    bot: { limits: { x: 300, y: 300 } },
    isDebug: true,
    isVirtual: true,
  });

  plotter.plot(svg);
});
