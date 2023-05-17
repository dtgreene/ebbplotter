# EBBPlotter

## Usage

Basic usage to plot an SVG: 

```javascript

```

## Plotter Options

| Name | Default | Description | Type |
| ---- | ---- | ---- | ---- |
| isVirtual | `false` | Indicates if the plotter should run in virtual mode. In virtual mode, no serial connection is made and serial writes are simulated. | `boolean` |
| isDebug | `false` | Indicates if debug logging should be enabled. | `boolean` |
| machine | See machine options | Options related to the plotter. | |

## Machine Options
| Name | Default | Description | Type |
| ---- | ---- | ----- | ----- |
| path | (empty string) | The serial path to use when conncting to an EBB. If blank, the program will attempt to find the device automatically. | `boolean` | 
| initDuration | `1000` | How long to wait in ms between performing setup and actually plotting. | `number` |
| stepper | See stepper options | Options related to the stepper motor. | |
| servo | See servo options | Options related to the servo motor. | |
| limits.x | `300` | The X travel limit in mm. | `number` |
| limits.y | `218` | The Y travel limit in mm. | `number` |

## Stepper Options
| Name | Default | Description | Type |
| ---- | ---- | ----- | ----- |
| stepMode | `2` | The micro-stepping mode to use in the range of 1-5.  See the [SM](https://evil-mad.github.io/EggBot/ebb.html#EM) command reference for more info. | `number` |
| stepAngle | `1.8` | The step angle used by the stepper motors in degrees. | `number` |
| beltPitch | `2` | The pitch of the timing belts on the machine in millimeters. The common GT2 belts use a 2mm pitch. | `number` |
| toothCount | `20` | The number of teeth on the stepper motor timing pulleys. | `number` |
| swapAxes | `false` | Indicates if the X and Y axes should be swapped. | `boolean` |
| speed | See stepper speed options | Options related to the stepper motor speed. | |

## Stepper Speed Options
| Name | Default | Description | Type |
| ---- | ---- | ----- | ----- |
| min | `200` | The lower range in steps per second the motors are allowed to move at. | `number` |
| max | `5000` | The upper range in steps per second the motors are allowed to move at.  Note that the EBB can drive at a maximum of 25,000 steps per second. | `number` |
| down | `80` | The plot speed while the pen is down as a percentage between the stepper's min and max speed. | `number` |
| up | `60` | The plot speed while the pen is up as a percentage between the stepper's min and max speed. | `number` |

## Servo Options
| Name | Default | Description | Type |
| ---- | ---- | ----- | ----- |
| duration | `1000` | The amount of time it takes for the pen to reach either the up or down state. | `number` |
| rate | `0` | The servo rate in pulses per channel, 0 for full speed.  See the [SC,10](https://evil-mad.github.io/EggBot/ebb.html#S2) command reference for more info. | `number` |
| min | `9855` | The minimum value for the servo's position in units of 83.3 ns intervals.  See the [SC,4](https://evil-mad.github.io/EggBot/ebb.html#SC) command reference for more info. | `number` |
| max | `27831` | The maximum value for the servo's position in units of 83.3 ns intervals.  See the [SC,5](https://evil-mad.github.io/EggBot/ebb.html#SC) command reference for more info. | `number` |
| down | `30` | The position of the servo when the pen is down as a percentage of the servo's min and max. | `number` |
| up | `70` | The position of the servo when the pen is up as a percentage of the servo's min and max. | `number` |

## License

[ISC](https://choosealicense.com/licenses/isc/)
