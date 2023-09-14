import { ReadlineParser, SerialPort } from 'serialport';
import logger from 'loglevel';

import { wait } from './utils.js';
import {
  SERVO_DURATION,
  SERVO_MIN_POSITION,
  SERVO_MAX_POSITION,
  SERVO_RATE,
  STEP_MODE,
  INVERT_X_AXIS,
  INVERT_Y_AXIS,
  STEPS_PER_MM,
} from './config.js';

const SERIAL_PRODUCT_ID = 'fd92';
const SERIAL_MANUFACTURER = 'schmalzhaus';
const SERIAL_VENDOR_ID = '04d8';
const SERIAL_BAUD_RATE = 9_600;
const WRITE_TIMEOUT = 1_000;
const READ_TIMEOUT = 1_000;
const MESSAGE_ACK = 'OK';
const MIN_VOLTAGE = 8;
const CYCLES_PER_SECOND = 25_000;
const LM_ACC_PER_SECOND = 2 ** 31 / CYCLES_PER_SECOND;

const portProps = ['productId', 'vendorId', 'manufacturer'];

export const PEN_STATES = {
  up: 0,
  down: 1,
};

export const COMMANDS = {
  servoConfigure: (param, value) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SC
    return `SC,${param},${value}`;
  },
  enableMotors: () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    return `EM,${STEP_MODE},${STEP_MODE}`;
  },
  disableMotors: () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    return 'EM,0,0';
  },
  setPenState: (state) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SP
    return `SP,${state}`;
  },
  stepperMove: (x1, y1, x2, y2, speed) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SM
    const deltaX = INVERT_X_AXIS ? x1 - x2 : x2 - x1;
    const deltaY = INVERT_Y_AXIS ? y1 - y2 : y2 - y1;
    const stepsX = Math.round(deltaX * STEPS_PER_MM);
    const stepsY = Math.round(deltaY * STEPS_PER_MM);

    if (speed === 0) {
      throw new Error('Invalid SM command input; speed cannot be zero');
    }

    if (stepsX === 0 && stepsY === 0) {
      throw new Error('Invalid SM command input; distance too short');
    }

    const distance = Math.hypot(deltaX, deltaY);
    const timeTotal = distance / speed;
    const duration = Math.round(timeTotal * 1000);

    return [`SM,${duration},${stepsX},${stepsY}`, duration];
  },
  stepperMoveAccelerated: (x1, y1, x2, y2, entrySpeed, exitSpeed) => {
    // https://evil-mad.github.io/EggBot/ebb.html#LM
    const deltaX = INVERT_X_AXIS ? x2 - x1 : x1 - x2;
    const deltaY = INVERT_Y_AXIS ? y2 - y1 : y1 - y2;
    const stepsX = deltaX * STEPS_PER_MM;
    const stepsY = deltaY * STEPS_PER_MM;

    if (entrySpeed === 0 && exitSpeed === 0) {
      throw new Error(
        'Invalid LM command input; entry and exit speeds cannot both be zero'
      );
    }

    if (Math.round(stepsX) === 0 && Math.round(stepsY) === 0) {
      throw new Error('Invalid LM command input; distance too short');
    }

    const distance = Math.hypot(deltaX, deltaY);
    const timeInitial = distance / entrySpeed;
    const timeFinal = distance / exitSpeed;

    const averageSpeed = (entrySpeed + exitSpeed) / 2;
    const timeTotal = distance / averageSpeed;

    const commandX = getLMAxis(stepsX, timeInitial, timeFinal, timeTotal);
    const commandY = getLMAxis(stepsY, timeInitial, timeFinal, timeTotal);
    const duration = timeTotal * 1000;

    return [`LM,${commandX},${commandY},3`, duration];
  },
};

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
  hasMotorVoltage = async () => {
    try {
      // https://evil-mad.github.io/EggBot/ebb.html#QC
      const result = await this._writeAndRead('QC');
      const { current, voltage } = parseVoltage(result);

      logger.debug(`Motor current: ${current.toFixed(2)}a`);
      logger.debug(`Motor voltage: ${voltage.toFixed(2)}v`);

      return voltage < MIN_VOLTAGE;
    } catch (error) {
      throw new Error(`Could not check motor voltage: ${error.message}`);
    }
  };
  setupServo = async () => {
    await this._write(COMMANDS.servoConfigure(10, SERVO_RATE));
    await this._write(COMMANDS.servoConfigure(4, SERVO_MIN_POSITION));
    await this._write(COMMANDS.servoConfigure(5, SERVO_MAX_POSITION));
  };
  enableMotors = async () => {
    await this._write(COMMANDS.enableMotors());
  };
  disableMotors = async () => {
    await this._write(COMMANDS.disableMotors());
  };
  penDown = async () => {
    await this._write(COMMANDS.setPenState(PEN_STATES.down));
    await wait(SERVO_DURATION);
  };
  penUp = async () => {
    await this._write(COMMANDS.setPenState(PEN_STATES.up));
    await wait(SERVO_DURATION);
  };
  runCommands = async (plan) => {
    for (let j = 0; j < plan.length; j += 2) {
      const command = plan[j];
      const duration = plan[j + 1];

      await this._write(command);

      if (duration > 50) {
        await wait(duration - 30);
      }
    }
  };
  _write = (message) => {
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

function getPortProps(port) {
  return portProps.map((prop) =>
    typeof port[prop] === 'string' ? port[prop].toLowerCase() : ''
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

function parseVoltage(response) {
  const matches = response.match(/(\d{4})/);
  const value1 = parseInt(matches[0]);
  const value2 = parseInt(matches[1]);

  if (matches.length !== 2 || isNaN(value1) || isNaN(value2)) {
    throw new Error('Voltage response could not be parsed');
  }

  const current = (value1 * 3.3) / 1024 / 1.76;
  const voltage = ((value2 * 3.3) / 1024) * 9.2 + 0.3;

  return { current, voltage };
}

function getLMAxis(stepCount, timeInitial, timeFinal, timeTotal) {
  if (stepCount === 0) {
    return '0,0,0';
  }

  const rateInitial = Math.abs(
    Math.round((stepCount / timeInitial) * LM_ACC_PER_SECOND)
  );
  const rateFinal = Math.abs(
    Math.round((stepCount / timeFinal) * LM_ACC_PER_SECOND)
  );

  const rate = Math.round(rateInitial);
  const steps = Math.round(stepCount);
  const acceleration = Math.round(
    (rateFinal - rateInitial) / (timeTotal * CYCLES_PER_SECOND)
  );

  return `${rate},${steps},${acceleration}`;
}
