import { ReadlineParser, SerialPort } from 'serialport';
import logger from 'loglevel';

import { wait } from './utils.js';
import {
  SERVO_DURATION,
  SERVO_MAX_POS,
  SERVO_MIN_POS,
  SERVO_RATE,
  STEP_MODE,
} from './config.js';

const SERIAL_PRODUCT_ID = 'fd92';
const SERIAL_MANUFACTURER = 'schmalzhaus';
const SERIAL_VENDOR_ID = '04d8';
const SERIAL_BAUD_RATE = 9_600;
const WRITE_TIMEOUT = 1_000;
const READ_TIMEOUT = 1_000;
const INIT_TIMEOUT = 400;
const MESSAGE_ACK = 'OK';
const MIN_VOLTAGE = 8;

const portProps = ['productId', 'vendorId', 'manufacturer'];

export class EBB {
  port = null;
  lineParser = new ReadlineParser({ delimiter: '\r' });
  isConnected = false;
  readCallback = null;
  readResponse = '';
  connect = async (onDisconnect) => {
    if (this.isConnected) return;

    // List all available serial port devices
    const ports = await SerialPort.list();

    // Find the first valid EBB
    const ebbPort = ports.find((port) => {
      const [productId, vendorId, manufacturer] = getPortProps(port);

      if (process.platform === 'win32') {
        return vendorId === SERIAL_VENDOR_ID && productId === SERIAL_PRODUCT_ID;
      } else {
        return (
          manufacturer === SERIAL_MANUFACTURER &&
          productId === SERIAL_PRODUCT_ID
        );
      }
    });

    if (!ebbPort) {
      throw new Error('No EBB board found');
    }

    const { path } = ebbPort;
    return new Promise((resolve, reject) => {
      this.port = new SerialPort(
        { path, baudRate: SERIAL_BAUD_RATE },
        (error) => {
          if (!error) {
            setTimeout(() => {
              this.isConnected = true;
              // Flush the port initially to try and clear any garbage data
              this.port.flush(resolve);
            }, INIT_TIMEOUT);
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
      this.onDisconnect = onDisconnect;
    });
  };
  disconnect = async () => {
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
  checkVoltage = async () => {
    try {
      // https://evil-mad.github.io/EggBot/ebb.html#QC
      const result = await this.writeAndRead('QC');
      const matches = result.match(/(\d{4})/);
      const value1 = parseInt(matches[0]);
      const value2 = parseInt(matches[1]);

      if (matches.length !== 2 || isNaN(value1) || isNaN(value2)) {
        throw new Error('Voltage response could not be parsed');
      }

      const current = (value1 * 3.3) / 1024 / 1.76;
      const voltage = ((value2 * 3.3) / 1024) * 9.2 + 0.3;

      logger.debug(`Motor current: ${current.toFixed(2)}a`);
      logger.debug(`Motor voltage: ${voltage.toFixed(2)}v`);

      if (voltage < MIN_VOLTAGE) {
        throw new Error('Voltage too low');
      }
    } catch (error) {
      throw new Error(`Could not check motor voltage: ${error.message}`);
    }
  };
  setupServo = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#SC
    await this.write(`SC,10,${SERVO_RATE}`);
    await this.write(`SC,4,${SERVO_MIN_POS}`);
    await this.write(`SC,5,${SERVO_MAX_POS}`);
  };
  enableMotors = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    await this.write(`EM,${STEP_MODE},${STEP_MODE}`);
  };
  disableMotors = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    await this.write('EM,0,0');
  };
  penDown = async () => {
    await this.write('SP,1');
    await wait(SERVO_DURATION);
  };
  penUp = async () => {
    await this.write('SP,0');
    await wait(SERVO_DURATION);
  };
  write = (message) => {
    logger.debug(`Writing message: ${message}`);

    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject('Not connected');
      }
      if (this.readCallback) {
        reject('An existing response is pending');
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
  writeAndRead = (message) => {
    logger.debug(`Writing message: ${message}`);

    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject('Not connected');
      }
      if (this.readCallback) {
        reject('An existing response is pending');
      }

      const writeTimeout = setTimeout(() => {
        reject('Write timed out');
      }, WRITE_TIMEOUT);

      const readTimeout = setTimeout(() => {
        reject('Read timed out');
      }, READ_TIMEOUT);

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

    if (this.onDisconnect) {
      this.onDisconnect();
    }
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

function getPortProps(port) {
  return portProps.map((prop) =>
    typeof port[prop] === 'string' ? port[prop].toLowerCase() : ''
  );
}
