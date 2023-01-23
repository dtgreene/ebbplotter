# EBBPlotter

A simple way to plot an SVG in Node.js with plotters using the [EBB](http://www.schmalzhaus.com/EBB/). 

## Installation

```bash
npm i ebbplotter
```

## Usage

```javascript
import * as fs from 'fs';
import * as path from 'path';

import Plotter from 'ebbplotter';

const svgPath = path.resolve(__dirname, './smiley.svg');
const svg = fs.readFileSync(svgPath, 'utf-8').toString();

const plotter = new Plotter({
  bot: { limits: { x: 300, y: 300 } },
});

try {
  await plotter.plot(svg);
} catch(e) {
  console.error(`Plot failed; with error: ${e}`)
}
```

## License

[ISC](https://choosealicense.com/licenses/isc/)