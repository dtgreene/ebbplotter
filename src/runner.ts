import minimist from 'minimist';

import { SerialController } from './classes/SerialController';
import {
  Operation,
  PlotterOptions,
  RunnerInMessage,
  RunnerOutMessage,
} from './types';

const argv = minimist(process.argv.slice(2));

let operations: Operation[] = [];

// add process event listeners
process.on('message', onParentMessage);
// process.on('uncaughtException', onException);

// begin reading from stdin to keep the process open
process.stdin.resume();

// verify options argument
if (!argv.o) {
  throw new Error('Process created without required options');
}

const options = JSON.parse(argv.o) as PlotterOptions;

const serial = new SerialController(options.bot.path, {
  isVirtual: options.isVirtual,
});

async function beginOperations() {
  try {
    await serial.connect();
  } catch (e) {
    throw new Error(`Serial controller failed to connect: ${e}`);
  }
  console.log('Beginning operations...');
  nextOperation();
  sendParentMessage({ type: 'start' });
}

async function nextOperation() {
  if (operations.length === 0) {
    console.log('Operations finished');
    sendParentMessage({ type: 'finish' });
  } else {
    const operation = operations.shift();
    const { command, duration = 0 } = operation;

    try {
      await serial.write(command);
    } catch (e) {
      throw new Error(`Serial controller failed to write: ${e}`);
    }

    setTimeout(nextOperation, duration);
  }
}

function sendParentMessage(message: RunnerOutMessage) {
  process.send(message);
}

function onParentMessage(message: RunnerInMessage) {
  const { type, data } = message;
  switch (type) {
    case 'operations': {
      operations = data;
      beginOperations();
    }
  }
}
