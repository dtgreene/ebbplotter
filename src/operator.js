import { percentBetween, wait } from './utils.js';
import { RESPONSE_ACK } from './constants.js';

export class Operator {
  options = {};
  serial = undefined;
  constructor(serial, options) {
    this.options = options;
    this.serial = serial;
  }
  getMotorVoltage = async () => {
    try {
      const result = await this.serial.write('QC');
      // result format: value1,value2\r\nOK\r\n
      const values = result.replace(RESPONSE_ACK, '').trim().split(',');
      const vPlusVoltage = parseInt(values[1]);

      if (isNaN(vPlusVoltage)) {
        throw new Error('Could not parse voltage');
      }

      return vPlusVoltage;
    } catch (e) {
      throw new Error(`Voltage check failed: ${e}`);
    }
  };
  penDown = async () => {
    const { servo } = this.options.machine;
    await this.serial.write('SP,1');
    await wait(servo.duration);
  };
  penUp = async () => {
    const { servo } = this.options.machine;
    await this.serial.write('SP,0');
    await wait(servo.duration);
  };
  enableMotors = async () => {
    const { stepper } = this.options.machine;
    await this.serial.write(`EM,${stepper.stepMode},${stepper.stepMode}`);
  };
  disableMotors = async () => {
    await this.serial.write('EM,0,0');
  };
  setupServo = async () => {
    const { servo } = this.options.machine;

    // servo settings
    const servoMin = Math.round(
      percentBetween(servo.min, servo.max, servo.down)
    );
    const servoMax = Math.round(percentBetween(servo.min, servo.max, servo.up));

    // set servo rate
    await this.serial.write(`SC,10,${servo.rate}`);
    // set servo min
    await this.serial.write(`SC,4,${Math.round(servoMin)}`);
    // set servo max
    await this.serial.write(`SC,5,${Math.round(servoMax)}`);
  };
  stepMotors = async (stepsX, stepsY, duration) => {
    await this.serial.write(`SM,${duration},${stepsX},${stepsY}`);
    await wait(Math.max(0, duration - 30));
  };
}
