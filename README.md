# EBBPlotter

<p align="center">
  <img src="https://github.com/dtgreene/ebbplotter/assets/24302976/16256342-f252-4e7a-ac87-e87c649266f8" width="400" />
</p>
<p align="center">
  A plotting program for machines using the <a href="http://www.schmalzhaus.com/EBB/">EiBotBoard</a>
</p>

## Usage

Most of the options are configured for my DIY machine so you may need to tweak some values before using.  Especially the plot dimensions to avoid machine crashes.

From there, the easiest way to plot is to place your SVG file in the `src/assets` directory and run `npm start`.  The prompt will offer a few operations to choose from.

![image](https://github.com/dtgreene/ebbplotter/assets/24302976/0709451a-f001-42f3-8586-9e3043462a61)

You can also preview plots to get an idea of the dimensions and layout of the actual plot including pen down and pen up movements.

![image](https://github.com/dtgreene/ebbplotter/assets/24302976/4b212ce1-1a53-403a-b823-697bbb8a3d8e)

## Canvas dependency

There is an optional `canvas` dependency which will attempt to download a binary for your OS architecture.  If you have issues installing or don't care about previewing plots, you can omit this dependency by using the `--no-optional` flag while installing. Ex. `npm install --no-optional`

You can see further installation instructions [here](https://www.npmjs.com/package/canvas).

## Usage notes
- SVG width and height properties are required and should contain only numbers (no units included).  These values are always treated as millimeters which may be different from other plotting programs.
- There currently is no acceleration/jerk control.  Plotting is simply executed as constant speed, point-to-point movements.  Care should be taken when adjusting the speed settings to preserve accuracy and prevent possible damage to the machine.
- There currently is no support for CoreXY machines such as the AxiDraw.  This should be pretty trivial to add but I have not looked into it since this was made to control a DIY machine. 

## Options

Most of the options you may want to change are defined in [constants.js](src/constants.js). 

## License

[ISC](https://choosealicense.com/licenses/isc/)
