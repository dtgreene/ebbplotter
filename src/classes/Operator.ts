import { PlotterOptions } from '../types';
import { percentBetween, wait } from '../utils';
import { ebbInfo } from '../constants';
import { SerialController } from './SerialController';

export class Operator {
  private options: PlotterOptions;
  private serial: SerialController;
  constructor(serial: SerialController, options: PlotterOptions) {
    this.options = options;
    this.serial = serial;
  }
  public getMotorVoltage = async () => {
    try {
      const result = await this.serial.write('QC');
      // result format: value1,value2\r\nOK\r\n
      const values = result.replace(ebbInfo.ack, '').trim().split(',');
      const vPlusVoltage = parseInt(values[1]);

      return vPlusVoltage;
    } catch (e) {
      throw new Error(`Voltage check failed: ${e}`);
    }
  };
  public penDown = async () => {
    const { servo } = this.options.machine;
    await this.serial.write('SP,1');
    await wait(servo.duration);
  };
  public penUp = async () => {
    const { servo } = this.options.machine;
    await this.serial.write('SP,0');
    await wait(servo.duration);
  };
  public enableMotors = async () => {
    const { stepper } = this.options.machine;
    await this.serial.write(`EM,${stepper.stepMode},${stepper.stepMode}`);
  };
  public disableMotors = async () => {
    await this.serial.write('EM,0,0');
  };
  public setupServo = async () => {
    const { servo } = this.options.machine;

    // servo settings
    const servoMin = Math.round(
      percentBetween(servo.min, servo.max, servo.down),
    );
    const servoMax = Math.round(percentBetween(servo.min, servo.max, servo.up));

    // set servo rate
    await this.serial.write(`SC,10,${servo.rate}`);
    // set servo min
    await this.serial.write(`SC,4,${Math.round(servoMin)}`);
    // set servo max
    await this.serial.write(`SC,5,${Math.round(servoMax)}`);
  };
  public stepMotors = async (
    stepsX: number,
    stepsY: number,
    duration: number,
  ) => {
    await this.serial.write(`SM,${duration},${stepsX},${stepsY}`);
    await wait(Math.max(0, duration - 30));
  };
}
