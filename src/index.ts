import * as fs from 'fs';
import * as path from 'path';

import { EBBPlotter } from './classes/EBBPlotter';

const svgPath = path.resolve(__dirname, './assets/smiley_processed.svg');
const svg = fs.readFileSync(svgPath, 'utf-8').toString();

const plotter = new EBBPlotter({
  bot: { limits: { x: 300, y: 300 } },
  isDebug: true,
  isVirtual: true
});

plotter.on('operationstart', () => console.log('operation started'));
plotter.on('operationfinish', () => console.log('operation finished'));
plotter.on('operationerror', () => console.log('operation failed'));

plotter.plot(svg);
