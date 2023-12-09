import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';

import { EBB } from './lib/ebb.js';
import { MotionPlanner } from './lib/motion.js';

class SocketsManager {
  connections = [];
  emitter = new EventEmitter();
  on = (eventName, listener) => {
    this.emitter.on(eventName, listener);
  };
  off = (eventName, listener) => {
    this.emitter.off(eventName, listener);
  };
  add = (connection) => {
    // Create a unique id for the connection
    connection.id = nanoid();

    this.connections.push(connection);

    connection.socket.on('close', () => {
      this._onSocketClose(connection);
    });

    this.emitter.emit('connect', connection);
  };
  sendAll = (message) => {
    this.connections.forEach((connection) => {
      connection.socket.send(message);
    });
  };
  send = (connection, message) => {
    connection.socket.send(message);
  };
  _onSocketClose = (connection) => {
    this.connections = this.connections.filter(
      ({ id }) => connection.id !== id,
    );
  };
}

export class Plotter {
  ebb = new EBB();
  sockets = new SocketsManager();
  isPlotting = false;
  isStopped = false;
  constructor() {
    this.ebb.on('connect', this._onSerialChange);
    this.ebb.on('disconnect', this._onSerialChange);
    this.sockets.on('connect', this._onSocketConnect);
  }
  plot = async (pathList, machine) => {
    this.isPlotting = true;
    this.isStopped = false;
    this.sockets.sendAll(this._getStatusMessage());

    try {
      const { stepper } = machine;
      await this.ebb.enableMotors(stepper.stepMode);

      const planner = new MotionPlanner(machine);
      const commands = planner.plan(pathList);

      let index = 0;

      this.progressInterval = setInterval(() => {
        this.sockets.sendAll(
          this._getProgressMessage(index / (commands.length - 1)),
        );
      }, 500);

      while (index < commands.length) {
        if (this.isStopped) {
          await ebb.stop();
          throw new Error('Plot was cancelled');
        }

        const command = commands[index];
        const duration = commands[index + 1];

        await this.ebb.write(command, duration);

        index += 2;
      }

      await this.ebb.disableMotors();
    } catch (error) {
      console.error(error);
    }

    this.isPlotting = false;
    this.sockets.sendAll(this._getStatusMessage());
  };
  // estimate = () => {};
  stop = () => {
    this.isStopped = true;
  };
  _onSerialChange = () => {
    this.sockets.sendAll(this._getStatusMessage());
  };
  _onSocketConnect = (connection) => {
    this.sockets.send(connection, this._getStatusMessage());
  };
  _getProgressMessage = (progress) => {
    return JSON.stringify({
      type: 'progress',
      payload: progress,
    });
  };
  _getStatusMessage = () => {
    return JSON.stringify({
      type: 'status',
      payload: {
        isConnected: this.ebb.isConnected,
        isPlotting: this.isPlotting,
      },
    });
  };
}
