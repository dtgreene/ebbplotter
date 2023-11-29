import { nanoid } from 'nanoid';
import { EBB } from './lib/ebb.js';

export class PlotInterface {
  ebb = new EBB();
  sockets = [];
  addSocket = (connection) => {
    // Create a unique id for the connection
    connection.id = nanoid();

    this.sockets.push(connection);

    connection.socket.on('message', (message) => {
      this.onSocketMessage(connection, message);
    });

    connection.socket.on('close', () => {
      this.onSocketClose(connection);
    });

    // Send an initial status update
    connection.socket.send(this.getStatusMessage());
  };
  onSocketMessage = (connection, message) => {
    console.log(message);
  };
  onSocketClose = (connection) => {
    this.sockets = this.sockets.filter(({ id }) => connection.id !== id);
  };
  broadcast = (message) => {
    this.sockets.forEach((connection) => {
      connection.socket.send(message);
    });
  };
  getStatusMessage = () => {
    return JSON.stringify({
      type: 'status',
      payload: {
        serial: { isConnected: this.ebb.isConnected },
      },
    });
  };
  serialConnect = async () => {
    try {
      await this.ebb.connect(this.onSerialDisconnect);
      this.onSerialStatusChange();
    } catch {
      this.onSerialDisconnect();
    }
  };
  onSerialDisconnect = () => {
    setTimeout(this.serialConnect, 2000);

    this.onSerialStatusChange();
  };
  onSerialStatusChange = () => {
    this.broadcast(this.getStatusMessage());
  };
}
