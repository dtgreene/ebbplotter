import { ReadlineParser, SerialPort } from 'serialport';
import logger from 'loglevel';

import {
  BAUD_RATE,
  RESPONSE_ACK,
  BOARD_MANUFACTURER,
  BOARD_NAME,
  BOARD_PRODUCT_ID,
  IS_VIRTUAL,
  READ_WRITE_TIMEOUT,
} from './constants.js';

export class SerialController {
  path = '';
  callbacks = {};
  isConnected = false;
  port = undefined;
  writeCallback = undefined;
  isWaiting = false;
  writeResponse = '';
  constructor(path, callbacks) {
    this.path = path;
    this.callbacks = callbacks;
  }
  open = () => {
    return new Promise(async (resolve, reject) => {
      // skip connection if already connected
      if (this.isConnected) {
        logger.debug('Skipping serial connection; already connected');
        resolve();
        return;
      }

      // skip connection in virtual mode
      if (IS_VIRTUAL) {
        logger.debug('Skipping serial connection; in virtual mode');
        this.isConnected = true;
        resolve();
        return;
      }

      let targetPath = this.path;

      if (!targetPath) {
        // try to find an ebb automatically
        const autoPath = await this.getSerialPath();

        if (autoPath) {
          targetPath = autoPath;
        } else {
          reject(
            'No serial path was given and no valid devices could be found'
          );
          return;
        }
      }

      logger.debug(`Attempting to connect to an EBB at path: ${targetPath}`);

      // create serial port
      this.port = new SerialPort(
        { path: targetPath, baudRate: BAUD_RATE },
        (error) => {
          if (!error) {
            logger.debug(
              `Connected to an EBB at path ${targetPath} at ${BAUD_RATE} bps`
            );
            this.isConnected = true;
            resolve();
          } else {
            reject(error);
          }
        }
      );
      // add event listeners
      this.port.on('disconnect', this.onPortClose);
      this.port.on('close', this.onPortClose);

      // read data coming back from the port
      const parser = this.port.pipe(new ReadlineParser({ delimiter: '\r' }));
      parser.on('data', this.onSerialData);
    });
  };
  close = () => {
    if (!this.isConnected || IS_VIRTUAL) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.port.flush(() => {
        this.port.close((error) => {
          if (!error) {
            this.isConnected = false;

            resolve();
          } else {
            reject(error);
          }
        });
      });
    });
  };
  write = (message) => {
    return new Promise((resolve, reject) => {
      try {
        if (!this.isConnected) {
          throw new Error('Not connected');
        }

        if (this.isWaiting) {
          throw new Error(
            "Attempted to write while waiting for a previous write's response"
          );
        }

        // timeout before giving up on reading
        const readTimeout = setTimeout(() => {
          reject(`Serial read failed due to timeout: ${message}`);
        }, READ_WRITE_TIMEOUT);

        // set waiting
        this.isWaiting = true;
        // reset write response
        this.writeResponse = '';

        // set the write callback to resolve the response
        this.writeCallback = (data) => {
          // reset write variables
          this.writeCallback = undefined;
          this.isWaiting = false;
          this.writeResponse = '';
          // clear the read timeout
          clearTimeout(readTimeout);
          // resolve the response
          resolve(data);
        };

        // write virtually
        if (IS_VIRTUAL) {
          logger.debug(`Writing serial message virtually: ${message}`);
          // simulate a response
          setTimeout(() => this.onSerialData(Buffer.from(RESPONSE_ACK)), 10);
          return;
        }

        // timeout before giving up on writing
        const writeTimeout = setTimeout(() => {
          reject(`Serial write failed due to timeout: ${message}`);
        }, READ_WRITE_TIMEOUT);

        // write data to the stream
        this.port.write(`${message}\r`, 'ascii');
        // wait until data has finished transmitting to the serial port
        this.port.drain(() => {
          clearTimeout(writeTimeout);
        });
      } catch (e) {
        reject(e);
      }
    });
  };
  onSerialData = (chunk) => {
    // responses for each operator command
    // SM - OK\r\n
    // SP - OK\r\n
    // QC - RA0_VOLTAGE,V+_VOLTAGE\r\nOK\r\n
    // SC - OK\r\n
    // EM - OK\r\n

    const data = chunk.toString().trim();
    if (this.isWaiting) {
      this.writeResponse += data;

      // responses received as multiple messages contain the ACK at the end
      if (this.writeResponse.includes(RESPONSE_ACK)) {
        this.writeCallback(this.writeResponse);
      }
    } else {
      logger.error(`Got unexpected message from the EBB: ${data}`);
    }
  };
  getSerialPath = async () => {
    logger.debug('Checking serial devices...');

    const botMaker = BOARD_MANUFACTURER.toLowerCase();
    const botName = BOARD_NAME.toLowerCase();

    // the resulting path
    let result = '';

    // list serial ports
    const ports = await SerialPort.list();

    ports.forEach((port) => {
      const portMaker = (port.manufacturer || '').toLowerCase();
      // convert reported product ID from hex string to decimal
      const portProductId = parseInt(
        `0x${(port.productId || '').toLowerCase()}`
      );
      const portPnpId = (port.pnpId || '').toLowerCase();

      logger.debug(`Found serial device at path: ${port.path}`);

      // OS specific board detection based on serialport 2.0.5
      switch (process.platform) {
        case 'win32': {
          // Match by manufacturer partial only.
          if (portMaker.indexOf(botMaker) > -1) {
            result = port.path;
          }
          break;
        }
        default: {
          // includes 'darwin', 'linux'
          // Match by Exact Manufacturer...
          if (portMaker === botMaker) {
            // Match by exact product ID (hex to dec), or PNP ID partial
            if (
              portProductId === BOARD_PRODUCT_ID ||
              portPnpId.indexOf(botName) !== -1
            ) {
              result = port.path;
            }
          }
          break;
        }
      }
    });
    return result;
  };
  onPortClose = () => {
    this.isConnected = false;
    this.port = undefined;
    this.writeCallback = undefined;
    this.isWaiting = false;
    this.writeResponse = '';

    if (this.callbacks.onClose) {
      this.callbacks.onClose();
    }
  };
}
