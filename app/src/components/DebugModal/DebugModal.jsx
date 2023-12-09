import React, { useRef } from 'react';
import { proxy, useSnapshot } from 'valtio';
import clsx from 'clsx';

import { createAlert, AlertTypes } from 'src/state/alert';
import { useModal } from 'src/hooks/useModal';
import { BaseModal } from '../BaseModal';
import { FieldLabel } from '../FieldLabel';
import { NumberInput } from '../NumberInput';
import { Button } from '../Button';

const CYCLES_PER_SECOND = 25_000;
const LM_ACC_PER_SECOND = 2 ** 31 / CYCLES_PER_SECOND;

const modalState = proxy({
  visible: false,
  mounted: false,
  timeoutId: null,
});

const state = proxy({
  json: '',
  width: '100',
  height: '100',
  stepsPerMM: '40',
  scale: '4',
  isDrawn: false,
});

const handleJSONChange = (event) => {
  state.json = event.target.value;
};

const handleWidthChange = (event) => {
  state.width = event.target.value;
};

const handleHeightChange = (event) => {
  state.height = event.target.value;
};

const handleStepsPerMMChange = (event) => {
  state.stepsPerMM = event.target.value;
};

const handleScaleChange = (event) => {
  state.scale = event.target.value;
};

export const DebugModal = ({ active, onClose }) => {
  const { visible, mounted } = useModal(modalState, active);
  const stateSnap = useSnapshot(state);
  const canvasRef = useRef();

  if (!mounted) return null;

  const handleDrawClick = () => {
    try {
      const data = JSON.parse(state.json);
      drawImage(canvasRef.current, data);

      state.isDrawn = true;
    } catch (error) {
      createAlert({
        title: 'Debug failed',
        message: error.message,
        type: AlertTypes.ERROR,
      });
    }
  };

  const drawDisabled =
    !stateSnap.json ||
    !stateSnap.width ||
    !stateSnap.height ||
    !stateSnap.stepsPerMM ||
    !stateSnap.scale;

  return (
    <BaseModal title="Debug" visible={visible} onClose={onClose}>
      <div className="mb-8 mt-4">
        <div>
          <FieldLabel className="mb-1">Command JSON</FieldLabel>
          <textarea
            className="bg-transparent rounded px-2 py-1 __border w-full transition-opacity text-xs font-mono"
            rows="5"
            value={stateSnap.json}
            onChange={handleJSONChange}
          />
        </div>
        <div className="flex gap-2">
          <NumberInput
            label="Width"
            className="flex-1"
            value={stateSnap.width}
            onChange={handleWidthChange}
          />
          <NumberInput
            label="Height"
            className="flex-1"
            value={stateSnap.height}
            onChange={handleHeightChange}
          />
        </div>
        <div className="flex gap-2">
          <NumberInput
            label="Steps Per MM"
            value={stateSnap.stepsPerMM}
            onChange={handleStepsPerMMChange}
          />
          <NumberInput
            label="Canvas Scale"
            value={stateSnap.scale}
            onChange={handleScaleChange}
          />
        </div>
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className={clsx('__border', {
              hidden: !stateSnap.isDrawn,
              'mt-8': stateSnap.isDrawn,
            })}
          />
        </div>
      </div>
      <div className="flex justify-end gap-4">
        <Button className="flex-1" onClick={onClose} variant="primaryOutlined">
          Close
        </Button>
        <Button
          className="flex-1"
          onClick={handleDrawClick}
          disabled={drawDisabled}
        >
          Draw Debug
        </Button>
      </div>
    </BaseModal>
  );
};

function drawImage(canvas, data) {
  const ctx = canvas.getContext('2d');

  const position = { x: 0, y: 0 };
  const scale = Number(state.scale);
  const width = Number(state.width) * scale;
  const height = Number(state.height) * scale;
  const stepsPerMM = Number(state.stepsPerMM);

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'aqua';

  let penDown = false;
  ctx.beginPath();

  for (let i = 0; i < data.length; i++) {
    if (typeof data[i] === 'number') continue;

    const command = data[i];

    if (command.includes('LM,')) {
      const [deltaX, deltaY] = debugLMCommand(command, stepsPerMM);

      position.x += deltaX;
      position.y += deltaY;

      if (penDown) {
        ctx.lineTo(position.x * scale, position.y * scale);
      }
    } else if (command.includes('SM,')) {
      const [deltaX, deltaY] = debugSMCommand(command, stepsPerMM);

      position.x += deltaX;
      position.y += deltaY;

      if (penDown) {
        ctx.lineTo(position.x * scale, position.y * scale);
      }
    } else if (command.includes('S2,')) {
      if (Number(command.match(/S2,(\d+)/)[1]) < 10_000) {
        penDown = true;
        ctx.moveTo(position.x * scale, position.y * scale);
      } else {
        penDown = false;
      }
    }
  }
  ctx.stroke();
}

function debugSMCommand(command, stepsPerMM) {
  const split = command.slice(3).split(',');

  const duration = Number(split[0]);
  const stepsX = Number(split[1]);
  const stepsY = Number(split[2]);

  return [stepsX / stepsPerMM, stepsY / stepsPerMM, duration];
}

function debugLMCommand(command, stepsPerMM) {
  const split = command.slice(3).split(',');

  const commandX = split.slice(0, 3);
  const commandY = split.slice(3, 6);

  const [deltaX, entrySpeed1, exitSpeed1] = debugLMAxis(commandX, stepsPerMM);
  const [deltaY, entrySpeed2, exitSpeed2] = debugLMAxis(commandY, stepsPerMM);

  const entrySpeed = (entrySpeed1 + entrySpeed2) * 0.5;
  const exitSpeed = (exitSpeed1 + exitSpeed2) * 0.5;

  return [deltaX, deltaY, entrySpeed, exitSpeed];
}

function debugLMAxis(command, stepsPerMM) {
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

  return [steps / stepsPerMM, entrySpeed, exitSpeed];
}
