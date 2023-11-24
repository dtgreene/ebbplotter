import { ReadlineParser, SerialPort } from 'serialport';
import logger from 'loglevel';

import { wait } from './utils.js';
import { Config } from './config.js';
import { getSMCommand, getLMCommand } from './movement.js';

const SERIAL_PRODUCT_ID = 'fd92';
const SERIAL_MANUFACTURER = 'schmalzhaus';
const SERIAL_VENDOR_ID = '04d8';
const SERIAL_BAUD_RATE = 9_600;
const WRITE_TIMEOUT = 1_000;
const READ_TIMEOUT = 1_000;
const MESSAGE_ACK = 'OK';
const PORT_PROPS = ['productId', 'vendorId', 'manufacturer'];

export class EBB {
  port = null;
  lineParser = new ReadlineParser({ delimiter: '\r' });
  isConnected = false;
  readCallback = null;
  readResponse = '';
  connect = async (onDisconnect) => {
    if (this.isConnected) return;

    // Find the first valid EBB
    const ebbPort = await getEBBPort();

    if (!ebbPort) {
      throw new Error('No EBB board found');
    }

    const { path } = ebbPort;
    return new Promise((resolve, reject) => {
      this.port = new SerialPort(
        { path, baudRate: SERIAL_BAUD_RATE },
        (error) => {
          if (!error) {
            // Flush the port initially to try and clear any garbage data
            this.port.flush(() => {
              this.isConnected = true;
              resolve();
            });
          } else {
            reject(error);
          }
        },
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
  queryCurrent = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#QC
    // versions: v2.2.3 and newer
    try {
      const response = await this.writeAndRead('QC');
      const matches = response.match(/(\d{4})/);
      const value1 = parseInt(matches[0]);
      const value2 = parseInt(matches[1]);

      if (matches.length !== 2 || isNaN(value1) || isNaN(value2)) {
        throw new Error('Invalid response or parsing failed');
      }

      const current = (value1 * 3.3) / 1024 / 1.76;
      const voltage = ((value2 * 3.3) / 1024) * 9.2 + 0.3;

      logger.debug(`Motor current: ${current.toFixed(2)}a`);
      logger.debug(`Motor voltage: ${voltage.toFixed(2)}v`);

      return { current, voltage };
    } catch (error) {
      throw new Error(`Voltage check failed: ${error.message}`);
    }
  };
  setupServo = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#SC
    // versions: all
    const { RATE, MIN, MAX } = Config.SERVO;
    await this.write(`SC,${10},${RATE}`);
    await this.write(`SC,${4},${MIN}`);
    await this.write(`SC,${5},${MAX}`);
  };
  enableMotors = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    // versions: all
    const { MODE } = Config.STEPPER;
    await this.write(`EM,${MODE},1`);
  };
  disableMotors = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    // versions: all
    await this.write('EM,0,0');
  };
  penDown = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#SP
    // versions: all
    const { DURATION } = Config.SERVO;
    await this.write('SP,1');
    await wait(DURATION);
  };
  penUp = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#SP
    // versions: all
    const { DURATION } = Config.SERVO;
    await this.write('SP,0');
    await wait(DURATION);
  };
  queryVersion = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#V
    // versions: all

    // TODO: check if version needs parsing first
    return this.writeAndRead('V');
  };
  move = async (x1, y1, x2, y2, speed) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SM
    // versions: all
    await this.write(getSMCommand(x1, y1, x2, y2, speed));

    if (duration > 0) {
      await wait(duration);
    }
  };
  moveAccelerated = async (x1, y1, x2, y2, entrySpeed, exitSpeed) => {
    // https://evil-mad.github.io/EggBot/ebb.html#LM
    // versions: v2.7.0 and above
    await this.write(getLMCommand(x1, y1, x2, y2, entrySpeed, exitSpeed));

    if (duration > 0) {
      await wait(duration);
    }
  };
  write = (message) => {
    logger.debug(`Writing message: ${message}`);

    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    if (this.readCallback) {
      throw new Error('An existing response is pending');
    }

    if (typeof message !== 'string') {
      throw new Error('Invalid message type; expected string');
    }

    return new Promise((resolve, reject) => {
      const writeTimeout = setTimeout(
        () => reject('Write timed out'),
        WRITE_TIMEOUT,
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

    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    if (this.readCallback) {
      throw new Error('An existing response is pending');
    }

    if (typeof message !== 'string') {
      throw new Error('Invalid message type; expected string');
    }

    return new Promise((resolve, reject) => {
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

export function getStepsPerMM() {
  const { MODE } = Config.STEPPER;
  // See: https://evil-mad.github.io/EggBot/ebb.html#EM
  const MicroStepModes = {
    1: 16,
    2: 8,
    3: 4,
    4: 2,
    5: 1,
  };

  if (!(MODE in MicroStepModes)) {
    throw new Error('Invalid step mode');
  }
  // In degrees
  const stepAngle = 1.8;
  // In mm
  const beltPitch = 2;
  const pulleyToothCount = 20;

  const micro = MicroStepModes[MODE];
  const stepsPerRotation = (360 / stepAngle) * micro;
  const circumference = beltPitch * pulleyToothCount;

  return stepsPerRotation / circumference;
}

function getPortProps(port) {
  return PORT_PROPS.map((prop) =>
    typeof port[prop] === 'string' ? port[prop].toLowerCase() : '',
  );
}

async function getEBBPort() {
  // List all available serial port devices
  const ports = await SerialPort.list();

  // Find the first valid EBB
  return ports.find((port) => {
    const [productId, vendorId, manufacturer] = getPortProps(port);

    if (process.platform === 'win32') {
      return vendorId === SERIAL_VENDOR_ID && productId === SERIAL_PRODUCT_ID;
    } else {
      return (
        manufacturer === SERIAL_MANUFACTURER && productId === SERIAL_PRODUCT_ID
      );
    }
  });
}

function wait(duration) {
  return new Promise((res) => setTimeout(res, duration));
}
