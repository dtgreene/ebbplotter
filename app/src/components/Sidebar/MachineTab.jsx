import React, { useState } from 'react';
import { useSnapshot } from 'valtio';

import { appState } from 'src/state/app';
import { plotState } from 'src/state/plot';
import {
  controlState,
  setPen,
  enableMotors,
  disableMotors,
  jog,
  rebootBoard,
  eStop,
} from 'src/state/control';
import { socketState } from 'src/state/socket';
import { Button } from '../Button';
import { Select } from '../Select';
import { NumberInput } from '../NumberInput';
import { SidebarSection } from './SidebarSection';
import { FieldLabel } from '../FieldLabel';
import { CheckBox } from '../CheckBox';
import { stepModeOptions, StepsCalculatorModal } from '../StepsCalculatorModal';

const handleShowAdvancedChange = () => {
  appState.showAdvancedSettings = !appState.showAdvancedSettings;
};

const handleUpSpeedChange = ({ target }) => {
  const { stepper } = appState.machine;
  stepper.upSpeed = target.value;
};

const handleDownSpeedChange = ({ target }) => {
  const { stepper } = appState.machine;
  stepper.downSpeed = target.value;
};

const handleAccelerationChange = ({ target }) => {
  const { planning } = appState.machine;
  planning.acceleration = target.value;
};

const handleUpPercentChange = ({ target }) => {
  const { servo } = appState.machine;
  servo.upPercent = target.value;
};

const handleDownPercentChange = ({ target }) => {
  const { servo } = appState.machine;
  servo.downPercent = target.value;
};

const handleStepsPerMMChange = ({ target }) => {
  const { stepper } = appState.machine;
  stepper.stepsPerMM = target.value;
};

const handleStepModeChange = ({ target }) => {
  const { stepper } = appState.machine;
  stepper.stepMode = target.value;
};

const handleInvertXChange = () => {
  const { stepper } = appState.machine;
  stepper.invertX = !stepper.invertX;
};

const handleInvertYChange = () => {
  const { stepper } = appState.machine;
  stepper.invertY = !stepper.invertY;
};

const handleCoreXYChange = () => {
  const { stepper } = appState.machine;
  stepper.coreXY = !stepper.coreXY;
};

const handleCornerFactorChange = ({ target }) => {
  const { planning } = appState.machine;
  planning.cornerFactor = target.value;
};

const handleMinPositionChange = ({ target }) => {
  const { servo } = appState.machine;
  servo.minPosition = target.value;
};

const handleMaxPositionChange = ({ target }) => {
  const { servo } = appState.machine;
  servo.maxPosition = target.value;
};

const handleDurationChange = ({ target }) => {
  const { servo } = appState.machine;
  servo.duration = target.value;
};

const handleRateChange = ({ target }) => {
  const { servo } = appState.machine;
  servo.rate = target.value;
};

const handlePenUpClick = () => {
  const { servo } = appState.machine;
  setPen(servo.upPercent);
};

const handlePenDownClick = () => {
  const { servo } = appState.machine;
  setPen(servo.downPercent);
};

const handleJogDistanceChange = (event) => {
  appState.jogDistance = event.target.value;
};

const handleJogSpeedChange = (event) => {
  appState.jogSpeed = event.target.value;
};

const handleYPlusClick = () => {
  jog(0, appState.jogDistance);
};

const handleXMinusClick = () => {
  jog(-appState.jogDistance, 0);
};

const handleXPlusClick = () => {
  jog(appState.jogDistance, 0);
};

const handleYMinusClick = () => {
  jog(0, -appState.jogDistance);
};

export const MachineTab = () => {
  const [stepsModalActive, setStepsModalActive] = useState(false);
  const appSnap = useSnapshot(appState);
  const plotSnap = useSnapshot(plotState);
  const socketSnap = useSnapshot(socketState);
  const controlSnap = useSnapshot(controlState);

  const handleOpenStepsModalClick = () => {
    setStepsModalActive(true);
  };

  const handleStepsModalClose = () => {
    setStepsModalActive(false);
  };

  const { isLoading: previewIsLoading } = plotSnap.previewRequest;
  const { isLoading: controlIsLoading } = controlSnap.controlRequest;

  const { stepper, planning, servo } = appSnap.machine;
  const showAdvanced = appSnap.showAdvancedSettings;
  const { plotter } = socketSnap;
  const controlIsDisabled =
    previewIsLoading || controlIsLoading || !plotter.isConnected;

  return (
    <>
      <div className="flex items-center gap-2 mb-8">
        <CheckBox value={showAdvanced} onChange={handleShowAdvancedChange} />
        <FieldLabel>Show Advanced</FieldLabel>
      </div>
      <SidebarSection label="STEPPER">
        <div className="flex gap-4">
          <NumberInput
            value={stepper.upSpeed}
            onChange={handleUpSpeedChange}
            disabled={previewIsLoading}
            label="Up Speed"
            units="mm/s"
          />
          <NumberInput
            value={stepper.downSpeed}
            onChange={handleDownSpeedChange}
            disabled={previewIsLoading}
            label="Down Speed"
            units="mm/s"
          />
        </div>
        <NumberInput
          value={planning.acceleration}
          onChange={handleAccelerationChange}
          disabled={previewIsLoading}
          className="flex-1"
          label="Acceleration"
          units="mm/s²"
        />
        <div className="flex gap-4">
          <NumberInput
            value={servo.upPercent}
            onChange={handleUpPercentChange}
            disabled={previewIsLoading}
            label="Up Height"
            units="%"
          />
          <NumberInput
            value={servo.downPercent}
            onChange={handleDownPercentChange}
            disabled={previewIsLoading}
            label="Down Height"
            units="%"
          />
        </div>
        {showAdvanced && (
          <>
            <div className="flex gap-4">
              <NumberInput
                value={stepper.stepsPerMM}
                onChange={handleStepsPerMMChange}
                disabled={previewIsLoading}
                className="flex-1"
                label="Steps Per MM"
                units="steps/mm"
              />
              <Select
                value={stepper.stepMode}
                onChange={handleStepModeChange}
                options={stepModeOptions}
                disabled={previewIsLoading}
                className="flex-1"
                label="Step Mode"
              />
            </div>
            <Button
              variant="primaryOutlined"
              onClick={handleOpenStepsModalClick}
              disabled={previewIsLoading}
              className="my-4"
            >
              Open Steps Calculator
            </Button>
            <div className="flex">
              <div className="flex items-center gap-2 flex-1">
                <CheckBox
                  value={stepper.invertX}
                  onChange={handleInvertXChange}
                  disabled={previewIsLoading}
                />
                <FieldLabel>Invert X Axis</FieldLabel>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <CheckBox
                  value={stepper.invertY}
                  onChange={handleInvertYChange}
                  disabled={previewIsLoading}
                />
                <FieldLabel>Invert Y Axis</FieldLabel>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckBox
                value={stepper.coreXY}
                onChange={handleCoreXYChange}
                disabled={previewIsLoading}
              />
              <FieldLabel>Core XY</FieldLabel>
            </div>
          </>
        )}
      </SidebarSection>
      {showAdvanced && (
        <>
          <SidebarSection label="PLANNING">
            <NumberInput
              value={planning.cornerFactor}
              onChange={handleCornerFactorChange}
              disabled={previewIsLoading}
              label="Corner Factor"
              step="0.001"
            />
          </SidebarSection>
          <SidebarSection label="SERVO">
            <div className="flex gap-4">
              <NumberInput
                value={servo.minPosition}
                onChange={handleMinPositionChange}
                disabled={previewIsLoading}
                className="flex-1"
                label="Min Position"
                step="100"
              />
              <NumberInput
                value={servo.maxPosition}
                onChange={handleMaxPositionChange}
                disabled={previewIsLoading}
                className="flex-1"
                label="Max Position"
                step="100"
              />
            </div>
            <div className="flex gap-4">
              <NumberInput
                value={servo.duration}
                onChange={handleDurationChange}
                disabled={previewIsLoading}
                className="flex-1"
                label="Duration"
              />
              <NumberInput
                value={servo.rate}
                onChange={handleRateChange}
                disabled={previewIsLoading}
                className="flex-1"
                label="Rate"
              />
            </div>
          </SidebarSection>
        </>
      )}
      <SidebarSection label="CONTROL">
        <div className="flex gap-4">
          <Button
            className="flex-1"
            variant="primaryOutlined"
            disabled={controlIsDisabled}
            onClick={handlePenUpClick}
          >
            Pen Up
          </Button>
          <Button
            className="flex-1"
            variant="primaryOutlined"
            disabled={controlIsDisabled}
            onClick={handlePenDownClick}
          >
            Pen Down
          </Button>
        </div>
        <div className="flex gap-4 mb-4">
          <Button
            className="flex-1"
            variant="primaryOutlined"
            disabled={controlIsDisabled}
            onClick={enableMotors}
          >
            Enable Motors
          </Button>
          <Button
            className="flex-1"
            variant="primaryOutlined"
            disabled={controlIsDisabled}
            onClick={disableMotors}
          >
            Disable Motors
          </Button>
        </div>
        <div className="flex items-center mb-4">
          <div className="w-1/2">
            <div className="flex justify-center mb-1">
              <Button
                className="w-12"
                variant="primaryOutlined"
                disabled={controlIsDisabled}
                onClick={handleYPlusClick}
              >
                Y+
              </Button>
            </div>
            <div className="flex justify-center mb-1">
              <Button
                className="w-12"
                variant="primaryOutlined"
                disabled={controlIsDisabled}
                onClick={handleXMinusClick}
              >
                X-
              </Button>
              <div className="w-12" />
              <Button
                className="w-12"
                variant="primaryOutlined"
                disabled={controlIsDisabled}
                onClick={handleXPlusClick}
              >
                X+
              </Button>
            </div>
            <div className="flex justify-center">
              <Button
                className="w-12"
                variant="primaryOutlined"
                disabled={controlIsDisabled}
                onClick={handleYMinusClick}
              >
                Y-
              </Button>
            </div>
          </div>
          <div className="flex flex-col justify-center items-center w-1/2">
            <NumberInput
              value={appSnap.jogDistance}
              onChange={handleJogDistanceChange}
              disabled={previewIsLoading || controlIsLoading}
              className="w-32 mb-4"
              label="Jog Distance"
            />
            <NumberInput
              value={appSnap.jogSpeed}
              onChange={handleJogSpeedChange}
              disabled={previewIsLoading || controlIsLoading}
              className="w-32"
              label="Jog Speed"
            />
          </div>
        </div>
        <Button
          className="flex-1"
          variant="dangerOutlined"
          onClick={eStop}
          disabled={!plotter.isConnected}
        >
          Stop
        </Button>
        <div className="flex justify-center">
          <button
            className="hover:underline __text-muted text-sm transition-opacity disabled:opacity-50"
            disabled={controlIsDisabled}
            onClick={rebootBoard}
          >
            reboot board
          </button>
        </div>
      </SidebarSection>
      <StepsCalculatorModal
        active={stepsModalActive}
        onClose={handleStepsModalClose}
      />
    </>
  );
};
