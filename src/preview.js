import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import inquirer from 'inquirer';

import { WORK_AREA_DIMENSIONS } from './constants.js';

export async function createPlotPreview(createCanvas, segments) {
  const { outputFileName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputFileName',
      message: 'Enter the name of the file to output (with extension)',
      default: 'output.png',
      validate: (value) => {
        if (!value) {
          return 'Please enter a value';
        }

        return true;
      },
    },
  ]);

  const dimensionPadding = 48;
  const scale = 3;

  const { width, height } = WORK_AREA_DIMENSIONS;

  // scale the dimensions for a higher resolution
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const canvas = createCanvas(
    scaledWidth + dimensionPadding,
    scaledHeight + dimensionPadding
  );
  const ctx = canvas.getContext('2d');

  const colors = {
    dimensions: 'red',
    penDown: 'black',
    penUp: 'blue',
    background: '#dedede',
  };

  ctx.fillStyle = colors.background;
  ctx.fillRect(
    0,
    0,
    scaledWidth + dimensionPadding,
    scaledHeight + dimensionPadding
  );

  // draw the dimensions outline
  ctx.strokeStyle = colors.dimensions;
  ctx.fillStyle = colors.dimensions;
  ctx.strokeRect(0, 0, scaledWidth, scaledHeight);

  // draw dimensions text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '32px Sans';

  ctx.fillText(
    `${width}mm`,
    scaledWidth * 0.5,
    scaledHeight + dimensionPadding * 0.5
  );

  ctx.save();
  ctx.translate(scaledWidth + dimensionPadding * 0.5, scaledHeight * 0.5);
  ctx.rotate(Math.PI * 0.5);
  ctx.fillText(`${height}mm`, 0, 0);
  ctx.restore();

  // scaling here makes drawing a little cleaner in the next step
  const scaledSegments = segments.map((points) =>
    points.map((value) => value * scale)
  );

  // draw line segments
  let lastSegment = [0, 0];

  scaledSegments.forEach((points) => {
    // draw pen up movement
    ctx.beginPath();
    ctx.moveTo(lastSegment[0], lastSegment[1]);
    ctx.strokeStyle = colors.penUp;
    ctx.lineTo(points[0], points[1]);
    ctx.stroke();

    // draw pen down movement
    ctx.strokeStyle = colors.penDown;
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];

      ctx.lineTo(x, y);

      lastSegment = [x, y];
    }
    // actually closing the path helps prevent weird artifacts
    if (points[0] === lastSegment[0] && points[1] === lastSegment[1]) {
      ctx.closePath();
    }
    ctx.stroke();
  });

  // create the directory if non-existant
  if (!existsSync('src/output')) {
    mkdirSync('src/output');
  }

  const buffer = canvas.toBuffer();
  const outputPath = resolve('src/output', outputFileName);

  writeFileSync(outputPath, buffer);
}
