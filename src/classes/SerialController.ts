import { ReadlineParser, SerialPort } from 'serialport';

const EBB_SERIAL_INFO = {
  name: 'EiBotBoard',
  manufacturer: 'SchmalzHaus',
  vendorId: 1240,
  productId: 64914,
  baudRate: 9600,
  ack: 'OK',
};
const SERIAL_WRITE_TIMEOUT = 500;

export type SerialControllerOptions = {
  isVirtual: boolean;
};

export class SerialController {
  public isConnected = false;
  private options: SerialControllerOptions;
  private path: string;
  private port: SerialPort | undefined = undefined;
  constructor(path: string, options: SerialControllerOptions) {
    this.path = path;
    this.options = options;
  }
  public connect = () => {
    return new Promise<void>(async (resolve, reject) => {
      const { isVirtual } = this.options;

      // skip connection if already connected
      if (this.isConnected) {
        console.log('Skipping serial connection; already connected');
        resolve();
        return;
      }

      // skip connection in virtual mode
      if (isVirtual) {
        console.log('Skipping serial connection; in virtual mode');
        this.isConnected = true;
        resolve();
        return;
      }

      let targetPath = this.path;

      if (!targetPath) {
        const autoPath = await this.getSerialPort();

        if (autoPath) {
          targetPath = autoPath;
        } else {
          reject('No serial path was given and no ebb boards were found');
          return;
        }
      } else {
        console.log(`Using given serial path: ${targetPath}`);
      }

      console.log(`Attempting to connect to ebb board at path: ${targetPath}`);

      // create serial port
      this.port = new SerialPort(
        { path: targetPath, baudRate: EBB_SERIAL_INFO.baudRate },
        (error) => {
          if (!error) {
            console.log(
              `Connected to ebb board at path ${targetPath} at ${EBB_SERIAL_INFO.baudRate} bps`
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
  public write = (message: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const { isVirtual } = this.options;
        if (isVirtual) {
          console.log(`Writing command virtually: ${message}`);
          resolve();
          return;
        }
        // timeout before giving up on writing
        const writeTimeout = setTimeout(() => {
          reject(`Serial write failed due to timeout: ${message}`);
        }, SERIAL_WRITE_TIMEOUT);

        // write data to the stream
        this.port.write(`${message}\r`, 'ascii', () => {
          // wait until data has finished transmitting to the serial port
          this.port.drain(() => {
            // discard unread and unwritten data
            this.port.flush(() => {
              resolve();
            });
          });
          clearTimeout(writeTimeout);
        });
      } catch (e) {
        reject(e);
      }
    });
  };
  private onSerialData = (chunk: any) => {
    try {
      const message = chunk.toString().trim();
      if (message !== EBB_SERIAL_INFO.ack) {
        console.log(`Non-ack message received from the ebb board: ${message}`);
      }
    } catch (e) {
      console.log('Failed to parse message from the ebb board');
    }
  };
  private getSerialPort = async () => {
    console.log('Discovering serial devices...');

    const { manufacturer, productId, name } = EBB_SERIAL_INFO;
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
        `0x${(port.productId || '').toLowerCase()}`
      );
      const portPnpId = (port.pnpId || '').toLowerCase();

      console.log(`Found serial device at path: ${port.path}`);

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
    throw new Error('Lost connection to serial device');
  };
}
