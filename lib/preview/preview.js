import { writeFileSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';

import { WORK_AREA } from './config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const templateSourcePath = resolve(__dirname, './preview.handlebars');
const outputPath = resolve(__dirname, './preview.html');
const templateSource = readFileSync(templateSourcePath, 'utf-8');

export function openPreview({ pathList, boundingBox }) {
  const template = Handlebars.compile(templateSource);
  const result = template({
    pathList: JSON.stringify(pathList),
    workArea: JSON.stringify(WORK_AREA),
    boundingBox: JSON.stringify(boundingBox),
  });

  writeFileSync(outputPath, result);

  try {
    spawn('open', [outputPath]);
  } catch (error) {
    console.error(
      `Preview was generated but could not be opened: ${error.message}`,
    );
  }
}
