import { EventEmitter } from 'node:events';
import { ReadlineParser, SerialPort } from 'serialport';
import logger from 'loglevel';

import { wait } from './utils.js';
import config from './config.ebb.js';

const SERIAL_PRODUCT_ID = 'fd92';
const SERIAL_MANUFACTURER = 'schmalzhaus';
const SERIAL_VENDOR_ID = '04d8';
const SERIAL_BAUD_RATE = 9_600;
const WRITE_TIMEOUT = 5_000;
const READ_TIMEOUT = 5_000;
const MESSAGE_ACK = 'OK';
const MOTOR_VOLTAGE_MIN = 8;
const CYCLES_PER_SECOND = 25_000;
const LM_ACC_PER_SECOND = (2 ** 31 - 1) / CYCLES_PER_SECOND; // = 85899.34588
const PEN_STATE = {
  UP: 0,
  DOWN: 1,
};

const { servo, stepper } = config;

export class EBB {
  port = null;
  lineParser = new ReadlineParser({ delimiter: '\r' });
  isConnected = false;
  emitter = new EventEmitter();
  readCallback = null;
  readResponse = '';
  penState = null;

  on = (what, callback) => {
    this.emitter.on(what, callback);
  };
  off = (what, callback) => {
    this.emitter.off(what, callback);
  };
  connect = async () => {
    if (this.isConnected) return;

    // List all available serial port devices
    const ports = await SerialPort.list();

    // Find the first valid EBB
    const ebbPort = ports.find((port) => {
      const productId = (port.productId ?? '').toLowerCase();

      if (process.platform === 'win32') {
        const vendorId = (port.vendorId ?? '').toLowerCase();
        return vendorId === SERIAL_VENDOR_ID && productId === SERIAL_PRODUCT_ID;
      } else {
        const manufacturer = (port.manufacturer ?? '').toLowerCase();
        return (
          manufacturer === SERIAL_MANUFACTURER &&
          productId === SERIAL_PRODUCT_ID
        );
      }
    });

    if (!ebbPort) {
      return Promise.reject('No board was found');
    }

    const { path } = ebbPort;
    return new Promise((resolve, reject) => {
      this.port = new SerialPort(
        { path, baudRate: SERIAL_BAUD_RATE },
        (error) => {
          if (!error) {
            this.isConnected = true;

            // Flush the port initially to try and clear any garbage data
            this.port.flush(resolve);
          } else {
            reject(error);
          }
        }
      );

      // Listen for parsed data
      this.lineParser.on('data', this._handleSerialData);
      // Pipe incoming data to the line parser
      this.port.pipe(this.lineParser);
      // Listen for close event
      this.port.once('close', this._handlePortClose);
    });
  };
  disconnect = async () => {
    if (!this.isConnected) return;

    await this.disableMotors();

    return new Promise((resolve, reject) => {
      this.port.flush(() => {
        this.port.close((error) => {
          if (!error) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
    });
  };
  checkMotorVoltage = async () => {
    try {
      // https://evil-mad.github.io/EggBot/ebb.html#QC
      const result = await this._writeAndRead('QC');
      const values = result.replace(MESSAGE_ACK, '').trim().split(',');
      const value1 = parseInt(values[0]);
      const value2 = parseInt(values[1]);

      if (isNaN(value1) || isNaN(value2)) {
        throw new Error('Parsing failed');
      }

      const current = (value1 * 3.3) / 1024 / 1.76;
      const voltage = ((value2 * 3.3) / 1024) * 9.2 + 0.3;

      logger.debug(`Motor current: ${current.toFixed(2)}a`);
      logger.debug(`Motor voltage: ${voltage.toFixed(2)}v`);

      return voltage >= MOTOR_VOLTAGE_MIN;
    } catch (error) {
      logger.error(`Could not determine motor voltage: ${error}`);
      return false;
    }
  };
  setupServo = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#SC
    const { min, max, rate } = servo;

    await this._write(`SC,10,${rate}`);
    await this._write(`SC,4,${min}`);
    await this._write(`SC,5,${max}`);
  };
  enableMotors = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    const { stepMode } = stepper;

    await this._write(`EM,${stepMode},${stepMode}`);
  };
  disableMotors = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    await this._write('EM,0,0');
  };
  penDown = async () => {
    if (this.penState === PEN_STATE.DOWN) return;
    const { duration } = servo;
    this.penState = PEN_STATE.DOWN;

    await this._write('SP,1');
    await wait(duration);
  };
  penUp = async () => {
    if (this.penState === PEN_STATE.UP) return;

    const { duration } = servo;
    this.penState = PEN_STATE.UP;

    await this._write('SP,0');
    await wait(duration);
  };
  moveTo = async (x1, y1, x2, y2, speed) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SM
    const { stepsPerMM } = stepper;

    const deltaX = x1 - x2;
    const deltaY = y1 - y2;
    const stepsX = Math.round(deltaX * stepsPerMM);
    const stepsY = Math.round(deltaY * stepsPerMM);

    if (stepsX === 0 && stepsY === 0) {
      throw new Error('Invalid move; points are too close together');
    }

    const distance = Math.hypot(deltaX, deltaY);
    const timeTotal = distance / speed;

    await this._write(`SM,${stepsX},${stepsY}`);
    await wait(timeTotal * 1000);
  };
  moveToAccelerated = async (x1, y1, x2, y2, initialSpeed, finalSpeed) => {
    // https://evil-mad.github.io/EggBot/ebb.html#LM
    const { stepsPerMM } = stepper;

    const deltaX = x1 - x2;
    const deltaY = y1 - y2;
    const stepsX = deltaX * stepsPerMM;
    const stepsY = deltaY * stepsPerMM;

    if (Math.round(stepsX) === 0 && Math.round(stepsY) === 0) {
      throw new Error('Invalid move; points are too close together');
    }

    const distance = Math.hypot(deltaX, deltaY);
    const timeInitial = distance / initialSpeed;
    const timeFinal = distance / finalSpeed;
    const timeTotal = distance / ((initialSpeed + finalSpeed) / 2);

    const commandX = getLMAxis(stepsX, timeInitial, timeFinal, timeTotal);
    const commandY = getLMAxis(stepsY, timeInitial, timeFinal, timeTotal);

    await this._write(`LM,${commandX},${commandY},3`);
    await wait(timeTotal * 1000);
  };
  _write = (message) => {
    logger.debug(`Writing message: ${message}`);

    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject('Not connected');
      }
      if (this.readCallback) {
        reject('Currently busy waiting for a pending response');
      }

      const writeTimeout = setTimeout(
        () => reject('Write timed out'),
        WRITE_TIMEOUT
      );

      this.port.write(message.concat('\r'), 'ascii');
      this.port.drain(() => {
        clearTimeout(writeTimeout);
        resolve();
      });
    });
  };
  _writeAndRead = (message) => {
    logger.debug(`Writing message: ${message}`);

    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject('Not connected');
      }
      if (this.readCallback) {
        reject('Currently busy waiting for a pending response');
      }

      const writeTimeout = setTimeout(
        () => reject('Write timed out'),
        WRITE_TIMEOUT
      );

      const readTimeout = setTimeout(
        () => reject('Read timed out'),
        READ_TIMEOUT
      );

      this.readCallback = () => {
        clearTimeout(readTimeout);

        resolve(this.readResponse);

        this.readCallback = null;
        this.readResponse = '';
      };
      this.readResponse = '';

      this.port.write(message.concat('\r'), 'ascii');
      this.port.drain(() => clearTimeout(writeTimeout));
    });
  };
  _handlePortClose = () => {
    this.isConnected = false;

    // Remove data listener
    this.lineParser.off('data', this._handleSerialData);
    // Detach the pipe
    this.port.unpipe(this.lineParser);

    this.emitter.emit('disconnect');
  };
  _handleSerialData = (chunk) => {
    const data = chunk.toString().trim();

    logger.debug(`Received message: ${data}`);

    if (this.readCallback) {
      this.readResponse += data;

      // Once the message contains the ACK, reading is finished
      if (this.readResponse.includes(MESSAGE_ACK)) {
        this.readCallback(this.readResponse);
      }
    }
  };
}

function getLMAxis(stepCount, timeInitial, timeFinal, timeTotal) {
  const rateInitial = Math.abs(
    Math.round((stepCount / timeInitial) * LM_ACC_PER_SECOND)
  );
  const rateFinal = Math.abs(
    Math.round((stepCount / timeFinal) * LM_ACC_PER_SECOND)
  );

  const rate = Math.round(rateInitial);
  const count = Math.round(stepCount);
  const acceleration = Math.round(
    (rateFinal - rateInitial) / (timeTotal * CYCLES_PER_SECOND)
  );

  return `${rate},${count},${acceleration}`;
}
