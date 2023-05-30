import { percentBetween, wait } from './utils.js';
import {
  RESPONSE_ACK,
  SERVO_OPTIONS,
  STEPPER_OPTIONS,
  MOVEMENT_TIME_OFFSET,
} from './constants.js';

export class Operator {
  serial = undefined;
  constructor(serial) {
    this.serial = serial;
  }
  getMotorCurrent = async () => {
    try {
      const result = await this.serial.write('QC');
      // result format: value1,value2\r\nOK\r\n
      const values = result.replace(RESPONSE_ACK, '').trim().split(',');
      const value1 = parseInt(values[0]);
      const value2 = parseInt(values[1]);

      if (isNaN(value1) || isNaN(value2)) {
        throw new Error('Parsing failed');
      }

      // https://evil-mad.github.io/EggBot/ebb.html#QC
      const current = (value1 * 3.3) / 1024 / 1.76;
      const voltage = ((value2 * 3.3) / 1024) * 9.2 + 0.3;

      return { current, voltage };
    } catch (e) {
      throw new Error(`Could not get motor voltages: ${e}`);
    }
  };
  penDown = async () => {
    await this.serial.write('SP,1');
    await wait(SERVO_OPTIONS.duration);
  };
  penUp = async () => {
    await this.serial.write('SP,0');
    await wait(SERVO_OPTIONS.duration);
  };
  enableMotors = async () => {
    await this.serial.write(
      `EM,${STEPPER_OPTIONS.stepMode},${STEPPER_OPTIONS.stepMode}`
    );
  };
  disableMotors = async () => {
    await this.serial.write('EM,0,0');
  };
  setupServo = async () => {
    const { height } = SERVO_OPTIONS;
    // servo settings
    const servoMin = Math.round(
      percentBetween(height.min, height.max, height.down)
    );
    const servoMax = Math.round(
      percentBetween(height.min, height.max, height.up)
    );

    // set servo rate
    await this.serial.write(`SC,10,${SERVO_OPTIONS.rate}`);
    // set servo min
    await this.serial.write(`SC,4,${Math.round(servoMin)}`);
    // set servo max
    await this.serial.write(`SC,5,${Math.round(servoMax)}`);
  };
  stepMotors = async (stepsX, stepsY, duration) => {
    await this.serial.write(`SM,${duration},${stepsX},${stepsY}`);
    await wait(Math.max(0, duration - MOVEMENT_TIME_OFFSET));
  };
}
