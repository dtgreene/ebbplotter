import { readFileSync } from 'node:fs';
import { EBB } from './lib/ebb.js';
import { MotionPlanner } from './lib/motion.js';

const ebb = new EBB();

async function main() {
  // const data = readFileSync('server/test_input.json', 'utf-8');
  // const json = JSON.parse(data);

  const machine = {
    stepper: {
      upSpeed: 80,
      downSpeed: 50,
      stepsPerMM: 40,
      stepMode: '2',
      invertX: true,
      invertY: false,
      coreXY: true,
    },
    planning: { cornerFactor: 0.001, acceleration: 800 },
    servo: {
      minPosition: 7500,
      maxPosition: 24000,
      upPercent: 60,
      downPercent: 30,
      duration: 300,
      rate: 0,
    },
  };

  const planner = new MotionPlanner(machine);
  const commands = planner.plan([
    [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ],
  ]);

  await ebb.connect();
  await ebb.enableMotors(machine.stepper.stepMode);

  for (let i = 0; i < commands.length; i += 2) {
    const command = commands[i];
    const duration = commands[i + 1];

    await ebb.write(command, duration);
  }

  // await ebb.write()

  await ebb.disconnect();
}

main();
