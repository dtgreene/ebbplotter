import * as fs from 'fs';
import * as path from 'path';
import { createSVGWindow } from 'svgdom';
const { createCanvas, loadImage } = require('canvas')

import { flattenSVG } from '../flatten-svg';

const canvas = createCanvas(200, 200)
const ctx = canvas.getContext('2d')

const svgPath = path.resolve(__dirname, './smiley_processed.svg');
const svgFile = fs.readFileSync(svgPath, 'utf-8');
const window = createSVGWindow();

window.document.documentElement.innerHTML = svgFile.toString();
const svgElement = window.document.documentElement as SVGSVGElement;

describe('flatten-svg', () => {
  it('works', () => {
    const points = flattenSVG(svgElement);
  });
});
