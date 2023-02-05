import { ReadlineParser, SerialPort } from 'serialport';
import logger from 'loglevel';

import { serialTimeout, ebbInfo } from '../constants';

export type SerialControllerOptions = {
  isVirtual: boolean;
  onClose: () => void;
};

export class SerialController {
  public isConnected = false;
  private options: SerialControllerOptions;
  private path: string;
  private port: SerialPort;
  private writeCallback: (data: string) => void | undefined;
  private isWaiting = false;
  private writeResponse = '';
  constructor(path: string, options: SerialControllerOptions) {
    this.path = path;
    this.options = options;
  }
  public open = () => {
    return new Promise<void>(async (resolve, reject) => {
      const { isVirtual } = this.options;

      // skip connection if already connected
      if (this.isConnected) {
        logger.debug('Skipping serial connection; already connected');
        resolve();
        return;
      }

      // skip connection in virtual mode
      if (isVirtual) {
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
          reject('No serial path was given and no EBBs were found');
          return;
        }
      }

      logger.debug(`Attempting to connect to an EBB at path: ${targetPath}`);

      // create serial port
      this.port = new SerialPort(
        { path: targetPath, baudRate: ebbInfo.baudRate },
        (error) => {
          if (!error) {
            logger.debug(
              `Connected to an EBB at path ${targetPath} at ${ebbInfo.baudRate} bps`,
            );
            this.isConnected = true;
            resolve();
          } else {
            reject(error);
          }
        },
      );
      // add event listeners
      this.port.on('disconnect', this.onPortClose);
      this.port.on('close', this.onPortClose);

      // read data coming back from the port
      const parser = this.port.pipe(new ReadlineParser({ delimiter: '\r' }));
      parser.on('data', this.onSerialData);
    });
  };
  public close = () => {
    if (!this.isConnected || this.options.isVirtual) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
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
  public write = (message: string) => {
    return new Promise<string>((resolve, reject) => {
      try {
        if (!this.isConnected) {
          throw new Error('Not connected');
        }

        if (this.isWaiting) {
          throw new Error(
            "Attempted to write while waiting for a previous write's response",
          );
        }

        // timeout before giving up on reading
        const readTimeout = setTimeout(() => {
          reject(`Serial read failed due to timeout: ${message}`);
        }, serialTimeout);

        // set waiting
        this.isWaiting = true;
        // reset write response
        this.writeResponse = '';

        // set the write callback to resolve the response
        this.writeCallback = (data: string) => {
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
        const { isVirtual } = this.options;
        if (isVirtual) {
          logger.debug(`Writing serial message virtually: ${message}`);
          // simulate a response
          setTimeout(() => this.onSerialData(Buffer.from(ebbInfo.ack)), 10);
          return;
        }

        // timeout before giving up on writing
        const writeTimeout = setTimeout(() => {
          reject(`Serial write failed due to timeout: ${message}`);
        }, serialTimeout);

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
  private onSerialData = (chunk: any) => {
    // responses for each operator command
    // SM - OK\r\n
    // SP - OK\r\n
    // QC - RA0_VOLTAGE,V+_VOLTAGE\r\nOK\r\n
    // SC - OK\r\n
    // EM - OK\r\n

    const data = chunk.toString().trim();
    if (this.isWaiting) {
      this.writeResponse += data;
      if (this.writeResponse.indexOf(ebbInfo.ack) > -1) {
        this.writeCallback(data);
      }
    } else {
      logger.error(`Got unexpected message from the EBB: ${data}`);
    }
  };
  private getSerialPath = async () => {
    logger.debug('Checking serial devices...');

    const { manufacturer, productId, name } = ebbInfo;
    const botMaker = manufacturer.toLowerCase();
    const botProductId = productId;
    const botName = name.toLowerCase();

    // the resulting path
    let result = '';

    // list serial ports
    const ports = await SerialPort.list();

    ports.forEach((port) => {
      const portMaker = (port.manufacturer || '').toLowerCase();
      // convert reported product ID from hex string to decimal
      const portProductId = parseInt(
        `0x${(port.productId || '').toLowerCase()}`,
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
              portProductId === botProductId ||
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
  private onPortClose = () => {
    this.isConnected = false;
    this.options.onClose();
  };
}
