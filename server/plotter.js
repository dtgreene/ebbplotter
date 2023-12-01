import { nanoid } from 'nanoid';
import { EventEmitter } from 'node:events';

import { EBB } from './lib/ebb.js';

const emitter = new EventEmitter();

export class PlotterInterface {
  isPlotting = false;
  connections = [];
  constructor() {
    this.ebb = new EBB();
    this.ebb.on('connect', this.onSerialConnectChange);
    this.ebb.on('disconnect', this.onSerialConnectChange);
  }
  serialConnect = () => {
    this.ebb.connect();
  };
  onSerialConnectChange = () => {
    this.broadcast(this.getStatusMessage());
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
}
