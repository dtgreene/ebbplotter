import { nanoid } from 'nanoid';
import { EBB } from './lib/ebb.js';

export class PlotterInterface {
  isPlotting = false;
  connections = [];
  constructor() {
    this.ebb = new EBB();

    this.serialConnect();
  }
  serialConnect = async () => {
    try {
      await this.ebb.connect(this.onSerialDisconnect);
      this.onSerialStatusChange();
    } catch {
      this.onSerialDisconnect();
    }
  };
  onSerialDisconnect = () => {
    if (this.autoConnect) {
      setTimeout(this.serialConnect, 2000);
    }

    this.onSerialStatusChange();
  };
  onSerialStatusChange = () => {
    this.broadcast(this.getStatusMessage());
  };
  addConnection = (connection) => {
    // Create a unique id for the connection
    connection.id = nanoid();

    this.connections.push(connection);

    connection.socket.on('message', (message) => {
      this.onSocketMessage(connection, message);
    });

    connection.socket.on('close', () => {
      this.onSocketClose(connection);
    });

    // Send the initial status message
    connection.socket.send(this.getStatusMessage());
  };
  onSocketMessage = (connection, message) => {
    console.log(message);
  };
  onSocketClose = (connection) => {
    this.connections = this.connections.filter(
      ({ id }) => connection.id !== id,
    );
  };
  broadcast = (message) => {
    this.connections.forEach((connection) => {
      connection.socket.send(message);
    });
  };
  getStatusMessage = () => {
    return JSON.stringify({
      type: 'status',
      payload: {
        isConnected: this.ebb.isConnected,
        isPlotting: this.isPlotting,
      },
    });
  };
}
