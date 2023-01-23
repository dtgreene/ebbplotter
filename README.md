# EBBPlotter

An easy way to plot SVGs in Node.js for plotters using the [EBB](http://www.schmalzhaus.com/EBB/).

## Installation

```bash
$ npm i ebbplotter
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
} catch (e) {
  console.error(`Plot failed; with error: ${e}`);
}
```

## Configuration options

| Name | Default | Description | Type |
| ---- | ---------- | ----- | ----- |
| isVirtual | `false` | Indicates if the plotter should run in virtual mode. In virtual mode, no serial connection is made and serial writes are simulated. | `boolean` |
| isDebug | `false` | Indicates if debug logging should be enabled. Useful for troubleshooting. | `boolean` |
| bot.path | (empty string) | The serial path to use when conncting to the ebb device. If blank, the program will attempt to find the device automatically. | `boolean` | 
| bot.initDuration | `1000` | How long to wait in ms between performing setup and actually plotting. | `number` |
| bot.disableMotorsOnFinish | `true` | Indicates if the plotter should disable the motors after completing a plot. | `boolean` |
| bot.stepper.stepMode | `2` | The micro-stepping mode to use in the range of 1-5.  See the [SM](https://evil-mad.github.io/EggBot/ebb.html#EM) command reference for more info. | `number` |
| bot.stepper.stepAngle | `1.8` | The step angle used by the stepper motors in degrees. | `number` |
| bot.stepper.beltPitch | `2` | The pitch of the timing belts on the machine in millimeters. The common GT2 belts use a 2mm pitch. | `number` |
| bot.stepper.toothCount | `20` | The number of teeth on the stepper motor timing pulleys. | `number` |
| bot.stepper.swapAxes | `false` | Indicates if the X and Y axes should be swapped. | `boolean` |
| bot.stepper.speed.min | `200` | The lower range in steps per second the motors are allowed to move at. | `number` |
| bot.stepper.speed.max | `5000` | The upper range in steps per second the motors are allowed to move at.  Note that the EBB can drive at a maximum of 25,000 steps per second. | `number` |
| bot.stepper.speed.up | `60` | The plot speed while the pen is up as a percentage between the stepper's min and max speed. | `number` |
| bot.stepper.speed.up | `80` | The plot speed while the pen is down as a percentage between the stepper's min and max speed. | `number` |
| bot.limits.x | `300` | The X travel limit in mm. | `number` |
| bot.limits.y | `218` | The Y travel limit in mm. | `number` |
| bot.servo.duration | `1000` | The amount of time the program assumes the pen has reached either the up or down state. | `number` |
| bot.servo.rate | `0` | The servo rate in pulses per channel, 0 for full speed.  See the [SC,10](https://evil-mad.github.io/EggBot/ebb.html#S2) command reference for more info. | `number` |
| bot.servo.min | `9855` | The minimum value for the servo's position in units of 83.3 ns intervals.  See the [SC,4](https://evil-mad.github.io/EggBot/ebb.html#SC) command reference for more info. | `number` |
| bot.servo.max | `27831` | The maximum value for the servo's position in units of 83.3 ns intervals.  See the [SC,5](https://evil-mad.github.io/EggBot/ebb.html#SC) command reference for more info. | `number` |
| bot.servo.up | `70` | The position of the servo when the pen is up as a percentage of the servo's min and max. | `number` |
| bot.servo.up | `30` | The position of the servo when the pen is down as a percentage of the servo's min and max. | `number` |
| bot.servo.invert | `false` | Indicates if the pen's up and down positions should be swapped. | `boolean` |

## License

[ISC](https://choosealicense.com/licenses/isc/)
