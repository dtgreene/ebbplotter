# EBBPlotter

<p align="center">
  <img src="https://github.com/dtgreene/ebbplotter/assets/24302976/16256342-f252-4e7a-ac87-e87c649266f8" width="400" />
</p>

A script for plotting SVG images using [EiBotBoard](http://www.schmalzhaus.com/EBB/) powered machines.

## Usage

To plot, simply place the SVG file in `src/assets` and run `npm run plot`.  The script will prompt for the file name as well as the width of the final image in millimeters.  

This project is not a library but more of a collection of scripts. You can check [the main script](src/index.js) for basic plotting usage.

## Usage notes
- SVG width and height properties are required and should contain only numbers (no units included).  These values are always treated as millimeters which may be different from other plotting programs.
- There currently is no acceleration/jerk control.  Plotting is simply executed as constant speed, point-to-point movements.  Care should be taken when adjusting the speed settings to preserve accuracy and prevent possible damage to the machine.
- There currently is no support for CoreXY machines such as the AxiDraw.  This should be pretty trivial to add but I have not looked into it since this was made to control a DIY machine. 

## Options

Most of the options you may want to change are defined as `PLOT_OPTIONS` in [constants.js](src/constants.js#L16).  
Here's a breakdown of what each option does:

| Name | Default | Description | Type |
| ---- | ---- | ---- | ---- |
| isVirtual | `false` | Indicates if the plotter should run in virtual mode. In virtual mode, no serial connection is made and plotting is simulated. | `boolean` |
| isDebug | `false` | Indicates if debug logging should be enabled. | `boolean` |
| machine | See machine options | Options related to the plotter. | `MachineOptions` |

## Machine Options
| Name | Default | Description | Type |
| ---- | ---- | ----- | ----- |
| path | (empty string) | The serial path to use when conncting to an EBB. If blank, the program will attempt to find the device automatically by looking at all connected serial devices. | `string` | 
| stepper | See stepper options | Options related to the stepper motor. | `StepperOptions` |
| servo | See servo options | Options related to the servo motor. | `ServoOptions` |
| limits.x | `300` | The X travel limit in millimeters. | `number` |
| limits.y | `218` | The Y travel limit in millimeters. | `number` |

## Stepper Options
| Name | Default | Description | Type |
| ---- | ---- | ----- | ----- |
| stepMode | `2` | The micro-stepping mode to use in the range of 1-5.  See the [SM](https://evil-mad.github.io/EggBot/ebb.html#EM) command reference for more info. | `number` |
| stepAngle | `1.8` | The step angle used by the stepper motors in degrees. | `number` |
| beltPitch | `2` | The pitch of the timing belts on the machine in millimeters. The common GT2 belts use a 2mm pitch. | `number` |
| toothCount | `20` | The number of teeth on the stepper motor timing pulleys. | `number` |
| speed | See stepper speed options | Options related to the stepper motor speed. | `StepperSpeedOptions` |

## Stepper Speed Options
| Name | Default | Description | Type |
| ---- | ---- | ----- | ----- |
| min | `200` | The lower range in steps per second the motors are allowed to move at. | `number` |
| max | `5000` | The upper range in steps per second the motors are allowed to move at.  Note that the EBB can drive at a maximum of 25,000 steps per second. | `number` |
| up | `60` | The plot speed while the pen is up as a percentage between the stepper's min and max speed. | `number` |
| down | `80` | The plot speed while the pen is down as a percentage between the stepper's min and max speed. | `number` |

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
