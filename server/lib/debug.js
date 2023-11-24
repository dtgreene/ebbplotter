const CYCLES_PER_SECOND = 25_000;
const LM_ACC_PER_SECOND = 2 ** 31 / CYCLES_PER_SECOND;
const STEPS_PER_MM = 40;

export function drawImage(data, scale = 1) {
  const position = { x: 0, y: 0 };

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.strokeStyle = 'aqua';

  data.forEach((commands) => {
    let penDown = false;
    ctx.beginPath();
    commands.forEach((line) => {
      if (typeof line === 'string') {
        if (line.includes('LM')) {
          const [deltaX, deltaY] = debugLMCommand(line);

          position.x += deltaX;
          position.y += deltaY;

          if (penDown) {
            ctx.lineTo(position.x * scale, position.y * scale);
          }
        } else if (line.includes('SM')) {
          const [deltaX, deltaY] = debugSMCommand(line);

          position.x += deltaX;
          position.y += deltaY;

          if (penDown) {
            ctx.lineTo(position.x * scale, position.y * scale);
          }
        } else if (line.includes('SP')) {
          if (line.includes('1')) {
            penDown = true;
            ctx.moveTo(position.x * scale, position.y * scale);
          } else {
            penDown = false;
          }
        }
      }
    });
    ctx.stroke();
  });
}

export function debugMotionPlan(plan) {}

export function debugSMCommand(command) {
  const split = command.slice(3).split(',');

  const duration = Number(split[0]);
  const stepsX = Number(split[1]);
  const stepsY = Number(split[2]);

  return [stepsX / STEPS_PER_MM, stepsY / STEPS_PER_MM, duration];
}

export function debugLMCommand(command) {
  const split = command.slice(3).split(',');

  const commandX = split.slice(0, 3);
  const commandY = split.slice(3, 6);

  const [deltaX, entrySpeed1, exitSpeed1] = debugLMAxis(commandX);
  const [deltaY, entrySpeed2, exitSpeed2] = debugLMAxis(commandY);

  const entrySpeed = (entrySpeed1 + entrySpeed2) * 0.5;
  const exitSpeed = (exitSpeed1 + exitSpeed2) * 0.5;

  return [deltaX, deltaY, entrySpeed, exitSpeed];
}

function debugLMAxis(command) {
  const rateInitial = Number(command[0]);
  const steps = Number(command[1]);
  const acceleration = Number(command[2]);

  const entrySpeed = rateInitial / LM_ACC_PER_SECOND;
  const a = LM_ACC_PER_SECOND;
  const b = LM_ACC_PER_SECOND * entrySpeed - rateInitial + entrySpeed;
  const c =
    -acceleration * steps * 2 * CYCLES_PER_SECOND - rateInitial * entrySpeed;

  const discriminant = b * b - 4 * a * c;
  const exitSpeed = (-b + Math.sqrt(discriminant)) / (2 * a);

  return [steps / STEPS_PER_MM, entrySpeed, exitSpeed];
}
