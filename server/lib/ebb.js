import logger from 'loglevel';
import colors from 'colors/safe.js';
import { EventEmitter } from 'node:events';
import { ReadlineParser, SerialPort } from 'serialport';

import { getSMCommand, getLMCommand, getPenCommand } from './movement.js';
import { wait } from './utils.js';

const SERIAL_PRODUCT_ID = 'fd92';
const SERIAL_MANUFACTURER = 'schmalzhaus';
const SERIAL_VENDOR_ID = '04d8';
const SERIAL_BAUD_RATE = 9_600;
const WRITE_TIMEOUT = 1_000;
const READ_TIMEOUT = 1_000;
const MESSAGE_ACK = 'OK';
const PORT_PROPS = ['productId', 'vendorId', 'manufacturer'];
const MIN_MOTOR_POWER = 8;
const MODE_TO_STEPS = {
  1: 16,
  2: 8,
  3: 4,
  4: 2,
  5: 1,
};
const STEPS_TO_MODE = {
  16: 1,
  8: 2,
  4: 3,
  2: 4,
  1: 5,
};
const RECONNECT_TIME = 2000;

logger.setDefaultLevel('DEBUG');

class ResponseHandler {
  constructor(onCompleted, multiple) {
    this.onCompleted = onCompleted;
    this.multiple = multiple;
    this.data = '';
  }
}

export class EBB {
  port = null;
  lineParser = new ReadlineParser({ delimiter: '\r' });
  isConnected = false;
  responseHandler = null;
  emitter = new EventEmitter();
  shouldReconnect = true;
  reconnectTimeout = null;
  connect = async () => {
    if (this.isConnected) return;

    // Find the first valid EBB
    const ebbPort = await getEBBPort();

    if (ebbPort) {
      const { path } = ebbPort;
      return new Promise((resolve, reject) => {
        this.port = new SerialPort(
          { path, baudRate: SERIAL_BAUD_RATE },
          (error) => {
            if (!error) {
              this.isConnected = true;
              resolve();

              logger.debug(colors.green('[Serial]: Connected.'));

              this.emitter.emit('connect');
            } else {
              reject(error);
            }
          },
        );

        // Listen for parsed data
        this.lineParser.on('data', this.onSerialData);
        // Pipe incoming data to the line parser
        this.port.pipe(this.lineParser);
        // Listen for close event
        this.port.once('close', this.onPortClose);
      });
    } else {
      this.reconnect();
      logger.debug(
        colors.green('Could not open serial port; EBB was not found.'),
      );
    }
  };
  disconnect = async () => {
    if (!this.isConnected) return;
    if (this.port && !this.port.isOpen) return;

    this.shouldReconnect = false;

    return new Promise((resolve, reject) => {
      this.port.close((error) => {
        if (!error) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  };
  reconnect = () => {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(this.connect, RECONNECT_TIME);
  };
  on = (eventName, listener) => {
    this.emitter.on(eventName, listener);
  };
  off = (eventName, listener) => {
    this.emitter.off(eventName, listener);
  };
  queryMotorModes = async () => {
    try {
      const response = await this.writeAndRead('QE');
      const matches = Array.from(response.matchAll(/\d+/g));
      const value1 = matches[0][0];
      const value2 = matches[1][0];

      if (matches.length !== 2) {
        throw new Error('Could not get motor modes');
      }

      const mode1 = String(STEPS_TO_MODE[value1] ?? 0);
      const mode2 = String(STEPS_TO_MODE[value2] ?? 0);

      return { mode1, mode2 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : error;
      throw new Error(`Query motor modes failed: ${errorMessage}`);
    }
  };
  queryCurrent = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#QC
    // versions: v2.2.3 and newer
    try {
      const response = await this.writeAndRead('QC');
      const value1 = Number(response.slice(0, 4));
      const value2 = Number(response.slice(5, 9));

      if (isNaN(value1) || isNaN(value2)) {
        throw new Error('Could not get voltage');
      }

      const current = (value1 * 3.3) / 1024 / 1.76;
      const voltage = ((value2 * 3.3) / 1024) * 9.2 + 0.3;

      return { current, voltage };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : error;
      throw new Error(`Query voltage failed: ${errorMessage}`);
    }
  };
  queryVersion = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#V
    // versions: all

    try {
      const response = await this.writeAndRead('V', false);
      const matches = response.match(/(\d\.\d\.\d)/);

      if (matches.length === 0) {
        throw new Error('Could not get version');
      }

      return matches[0];
    } catch (error) {
      throw new Error(`Query version failed: ${error.message}`);
    }
  };
  hasMotorPower = async () => {
    const { voltage } = await this.queryCurrent();

    return voltage >= MIN_MOTOR_POWER;
  };
  // setupServo = async (minPosition, maxPosition, rate) => {
  //   // https://evil-mad.github.io/EggBot/ebb.html#SC
  //   // versions: all
  //   await this.write(`SC,10,${rate}`);
  //   await this.write(`SC,4,${minPosition}`);
  //   await this.write(`SC,5,${maxPosition}`);
  // };

  enableMotors = async (stepMode, skipQuery = false) => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    // versions: all
    if (skipQuery) {
      await this.write(`EM,${stepMode},1`);
    } else {
      const { mode1, mode2 } = await this.queryMotorModes();

      if (mode1 !== stepMode || mode2 !== stepMode) {
        await this.write(`EM,${stepMode},1`);
      }
    }
  };
  disableMotors = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#EM
    // versions: all
    await this.write('EM,0,0');
  };
  setPen = async (position, rate, duration) => {
    // https://evil-mad.github.io/EggBot/ebb.html#S2
    // versions: v2.2.0 and later
    await this.write(getPenCommand(position, rate));
    await wait(duration);
  };
  penDown = async (duration) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SP
    // versions: all
    await this.write('SP,1');
    await wait(duration);
  };
  penUp = async (duration) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SP
    // versions: all
    await this.write('SP,0');
    await wait(duration);
  };
  reboot = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#RB
    // versions: v2.5.4 and newer
    await this.write('RB');
  };
  stop = async () => {
    // https://evil-mad.github.io/EggBot/ebb.html#ES
    // versions: v2.2.7 and newer (with changes)
    await this.write('ES');
  };
  move = async (x1, y1, x2, y2, speed, stepper) => {
    // https://evil-mad.github.io/EggBot/ebb.html#SM
    // versions: all
    const [command, duration] = getSMCommand(x1, y1, x2, y2, speed, stepper);
    await this.write(command);

    if (duration > 0) {
      await wait(duration);
    }
  };
  moveAccelerated = async (x1, y1, x2, y2, entrySpeed, exitSpeed, stepper) => {
    // https://evil-mad.github.io/EggBot/ebb.html#LM
    // versions: v2.7.0 and above
    const [command, duration] = getLMCommand(
      x1,
      y1,
      x2,
      y2,
      entrySpeed,
      exitSpeed,
      stepper,
    );
    await this.write(command);

    if (duration > 0) {
      await wait(duration);
    }
  };
  write = (message, delay = 0) => {
    logger.debug(colors.green(`[Serial]: Writing message: ${message}`));

    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    if (this.responseHandler) {
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
        if (delay > 0) {
          setTimeout(resolve, delay);
        } else {
          resolve();
        }
      });
    });
  };
  writeAndRead = (message, multiple = true) => {
    logger.debug(colors.green(`[Serial]: Writing message: ${message}`));

    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    if (this.responseHandler) {
      throw new Error('An existing response is pending');
    }

    if (typeof message !== 'string') {
      throw new Error('Invalid message type; expected string');
    }

    return new Promise((resolve, reject) => {
      const writeTimeout = setTimeout(() => {
        this.responseHandler = null;

        reject('Write timed out');
      }, WRITE_TIMEOUT);

      const readTimeout = setTimeout(() => {
        this.responseHandler = null;

        reject('Read timed out');
      }, READ_TIMEOUT);

      this.responseHandler = new ResponseHandler((data) => {
        clearTimeout(readTimeout);
        resolve(data);

        this.responseHandler = null;
      }, multiple);

      this.port.write(message.concat('\r'), 'ascii');
      this.port.drain(() => clearTimeout(writeTimeout));
    });
  };
  onPortClose = () => {
    this.isConnected = false;
    this.responseHandler = null;

    // Remove data listener
    this.lineParser.off('data', this.onSerialData);

    if (this.port) {
      this.port.unpipe(this.lineParser);
    }

    this.emitter.emit('disconnect');

    if (this.shouldReconnect) {
      this.reconnect();
    }
  };
  onSerialData = (chunk) => {
    const message = chunk.toString().trim();

    logger.debug(colors.green(`[Serial]: Received message: ${message}`));

    if (this.responseHandler) {
      this.responseHandler.data += message;

      const { multiple, onCompleted, data } = this.responseHandler;
      if ((data.includes(MESSAGE_ACK) && multiple) || !multiple) {
        onCompleted(data);
      }
    }
  };
}

export function getStepsPerMM({
  stepMode,
  stepAngle,
  beltPitch,
  pulleyToothCount,
}) {
  if (!(stepMode in MODE_TO_STEPS)) {
    throw new Error('Invalid step mode');
  }

  const steps = MODE_TO_STEPS[stepMode];
  const stepsPerRotation = (360 / stepAngle) * steps;
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
