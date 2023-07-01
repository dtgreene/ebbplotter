import { ReadlineParser, SerialPort } from 'serialport';
import logger from 'loglevel';

const SERIAL_PRODUCT_ID = 'fd92';
const SERIAL_MANUFACTURER = 'schmalzhaus';
const SERIAL_BAUD_RATE = 9_600;
const WRITE_TIMEOUT = 5_000;
const READ_TIMEOUT = 5_000;
const MESSAGE_ACK = 'OK';
const MOTOR_VOLTAGE_MIN = 8;
const PEN_STATE = {
  UP: 0,
  DOWN: 1,
};

export class EBB {
  port = null;
  lineParser = new ReadlineParser({ delimiter: '\r' });
  isConnected = false;
  eventTarget = new EventTarget();
  readCallback = null;
  readResponse = '';
  penState = null;

  on = (what, callback) => {
    this.eventTarget.addEventListener(what, callback);
  };
  off = (what, callback) => {
    this.eventTarget.removeEventListener(what, callback);
  };
  connect = async () => {
    if (this.isConnected) return;

    // List all available serial port devices
    const ports = await SerialPort.list();

    // Find the first valid EBB
    const ebbPort = ports.find((port) => {
      const { manufacturer, productId } = port;

      return (
        manufacturer.toLowerCase() === SERIAL_MANUFACTURER &&
        productId === SERIAL_PRODUCT_ID
      );
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
  /**
   * Disconnects the serial connection. This instance should be considered destroyed
   * after disconnecting and no longer be used.
   * */
  disconnect = () => {
    if (!this.isConnected) return;

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
  setupServo = async (min, max, rate) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SC
    await this._write(`SC,10,${rate}`);
    await this._write(`SC,4,${min}`);
    await this._write(`SC,5,${max}`);
  };
  enableMotors = async (stepMode) => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    await this._write(`EM,${stepMode},${stepMode}`);
  };
  disableMotors = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    await this._write('EM,0,0');
  };
  penDown = async () => {
    if (this.penState === PEN_STATE.DOWN) return;

    await this.serial.write('SP,1');
    await wait(SERVO_OPTIONS.duration);
    this.penState = PEN_STATE.DOWN;
  };
  penUp = async () => {
    if (this.penState === PEN_STATE.UP) return;

    await this.serial.write('SP,0');
    await wait(SERVO_OPTIONS.duration);
    this.penState = PEN_STATE.UP;
  };
  // stepMotors = async (stepsX, stepsY, duration) => {
  //   await this.serial.write(`SM,${duration},${stepsX},${stepsY}`);

  //   const waitTime = Math.max(0, duration - MOVEMENT_TIME_OFFSET);
  //   if (waitTime > 0) {
  //     await wait(waitTime);
  //   }
  // };
  _write = () => {
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
  _writeAndRead = () => {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject('Not connected');
      }
      if (this.writeCallback) {
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

    this.eventTarget.dispatchEvent(new CustomEvent('disconnect'));
  };
  _handleSerialData = (chunk) => {
    const data = chunk.toString().trim();
    if (this.readCallback) {
      this.readResponse += data;

      // Once the message contains the ACK, reading is finished
      if (this.writeResponse.includes(MESSAGE_ACK)) {
        this.writeCallback(this.writeResponse);
      }
    }
  };
}
