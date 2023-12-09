import React from 'react';
import { proxy, useSnapshot } from 'valtio';

import { appState } from 'src/state/app';
import { useModal } from 'src/hooks/useModal';
import { postRequest } from 'src/utils';
import { BaseModal } from '../BaseModal';
import { Button } from '../Button';
import { NumberInput } from '../NumberInput';
import { Select } from '../Select';

const modalState = proxy({
  visible: false,
  mounted: false,
  timeoutId: null,
});

const state = proxy({
  getStepsPerMM: {
    isLoading: false,
    isError: false,
    data: null,
  },
  stepAngle: '1.8',
  beltPitch: '2',
  pulleyToothCount: '20',
});

export const stepModeOptions = [
  { value: '1', label: '1/16' },
  { value: '2', label: '1/8' },
  { value: '3', label: '1/4' },
  { value: '4', label: '1/2' },
  { value: '5', label: '1' },
];

const handleStepAngleChange = (event) => {
  state.stepAngle = event.target.value;
};

const handleStepModeChange = (event) => {
  appState.machine.stepper.stepMode = event.target.value;
};

const handleBeltPitchChange = (event) => {
  state.beltPitch = event.target.value;
};

const handlePulleyToothChange = (event) => {
  state.pulleyToothCount = event.target.value;
};

const handleCalculateClick = async () => {
  if (state.getStepsPerMM.isLoading) return;

  state.getStepsPerMM.isLoading = true;

  const { stepMode } = stepper;
  const { stepAngle, beltPitch, pulleyToothCount } = state;
  const body = JSON.stringify({
    stepMode: Number(stepMode),
    stepAngle: Number(stepAngle),
    beltPitch: Number(beltPitch),
    pulleyToothCount: Number(pulleyToothCount),
  });

  postRequest(state.getStepsPerMM, { path: '/steps-per-mm', body });
};

export const StepsCalculatorModal = ({ active, onClose }) => {
  const { visible, mounted } = useModal(modalState, active);
  const appSnap = useSnapshot(appState);
  const stateSnap = useSnapshot(state);

  if (!mounted) return null;

  const { isLoading, data } = stateSnap.getStepsPerMM;
  const { stepper } = appSnap.machine;

  const handleUseValueClick = () => {
    appState.machine.stepper.stepsPerMM = data.stepsPerMM;
    onClose();
  };

  return (
    <BaseModal title="Steps Calculator" visible={visible} onClose={onClose}>
      <div className="mb-8 mt-4">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex gap-4">
            <NumberInput
              value={stateSnap.stepAngle}
              onChange={handleStepAngleChange}
              disabled={isLoading}
              className="flex-1"
              label="Step Angle"
              units="deg"
              step="0.1"
            />
            <Select
              value={stepper.stepMode}
              onChange={handleStepModeChange}
              options={stepModeOptions}
              disabled={isLoading}
              className="flex-1"
              label="Step Mode"
            />
          </div>
          <div className="flex gap-4">
            <NumberInput
              value={stateSnap.beltPitch}
              onChange={handleBeltPitchChange}
              disabled={isLoading}
              className="flex-1"
              label="Belt Pitch"
              units="mm"
              step="0.1"
            />
            <NumberInput
              value={stateSnap.pulleyToothCount}
              onChange={handlePulleyToothChange}
              disabled={isLoading}
              className="flex-1"
              label="Pulley Tooth Count"
              units="mm"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 flex-1 p-2">
            <span>{data ? data.stepsPerMM : 0}</span>
            <span>steps/mm</span>
          </div>
          <Button
            className="flex-1"
            onClick={handleCalculateClick}
            variant="primaryOutlined"
          >
            Calculate
          </Button>
        </div>
      </div>
      <div className="flex justify-end gap-4">
        <Button className="flex-1" onClick={onClose} variant="primaryOutlined">
          Close
        </Button>
        <Button
          className="flex-1"
          onClick={handleUseValueClick}
          disabled={!data || !data.stepsPerMM}
        >
          Use Calculated Value
        </Button>
      </div>
    </BaseModal>
  );
};
