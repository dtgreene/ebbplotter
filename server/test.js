import { EBB } from './lib/ebb.js';

const ebb = new EBB();

async function main() {
  await ebb.connect();
  const { mode1, mode2 } = await ebb.queryMotorModes();

  await ebb.disconnect();
}

function onProcessExit(handler) {
  process.on('SIGINT', handler);
  process.on('SIGQUIT', handler);
  process.on('SIGTERM', handler);
}

main();
