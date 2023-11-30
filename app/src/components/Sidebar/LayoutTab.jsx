import React from 'react';
import { useSnapshot } from 'valtio';
import clsx from 'clsx';

import { appState } from 'src/state/app';
import { plotState } from 'src/state/plot';
import { NumberInput } from '../NumberInput';
import { Select } from '../Select';
import { FieldLabel } from '../FieldLabel';
import { CheckBox } from '../CheckBox';
import { SlideSelect } from '../SlideSelect';
import { SidebarSection } from './SidebarSection';

import ArrowsLeftRightIcon from '../Icons/ArrowsLeftRight';

const alignmentOptions = ['Start', 'Middle', 'End'];
const sizeOptions = [
  { label: 'A3', value: '0', height: '297', width: '420' },
  { label: 'A4', value: '1', height: '210', width: '297' },
  { label: 'A5', value: '2', height: '148', width: '210' },
  { label: 'US Letter', value: '3', height: '215.9', width: '279.4' },
  { label: 'Custom', value: '4' },
];
const customSizeOption = sizeOptions[4];

const handleWidthChange = (event) => {
  const { dimensions } = appState;
  dimensions.width = event.target.value;
  dimensions.preset = customSizeOption.value;
};

const handleHeightChange = (event) => {
  const { dimensions } = appState;
  dimensions.height = event.target.value;
  dimensions.preset = customSizeOption.value;
};

const handleDimensionSwapClick = () => {
  const { dimensions } = appState;
  const width = dimensions.width;

  dimensions.width = dimensions.height;
  dimensions.height = width;
  dimensions.preset = customSizeOption.value;
};

const handleSizeChange = (event) => {
  const { value } = event.target;
  const { dimensions } = appState;

  const option = sizeOptions.find((option) => option.value === value);

  if (option.value !== customSizeOption.value) {
    dimensions.width = option.width;
    dimensions.height = option.height;
  }
  dimensions.preset = option.value;
};

const handleExcludeIdChange = (id) => {
  if (!plotState.excludeIds.includes(id)) {
    plotState.excludeIds.push(id);
  } else {
    plotState.excludeIds = plotState.excludeIds.filter(
      (excludeId) => excludeId !== id,
    );
  }
};

const handleTopMarginChange = ({ target }) => {
  const { margins } = appState;
  margins.top = target.value;
};

const handleRightMarginChange = ({ target }) => {
  const { margins } = appState;
  margins.right = target.value;
};

const handleBottomMarginChange = ({ target }) => {
  const { margins } = appState;
  margins.bottom = target.value;
};

const handleLeftMarginChange = ({ target }) => {
  const { margins } = appState;
  margins.left = target.value;
};

const handleAlignmentChange = (id) => {
  appState.alignment = id;
};

const handleRotationChange = ({ target }) => {
  appState.rotation = target.value;
};

const handleUseBoundingBoxChange = () => {
  appState.useBoundingBox = !appState.useBoundingBox;
};

const handleOptimizationChange = (key) => {
  appState.optimizations[key] = !appState.optimizations[key];
};

const handleMergeDistanceChange = (event) => {
  appState.optimizations.mergeDistance = event.target.value;
};

const handleRemoveShortDistanceChange = (event) => {
  appState.optimizations.removeShortDistance = event.target.value;
};

const handleRandomizeToleranceChange = (event) => {
  appState.optimizations.randomizeStartTolerance = event.target.value;
};

const handleDisplayChange = (key) => {
  appState.display[key] = !appState.display[key];
};

export const LayoutTab = () => {
  const appSnap = useSnapshot(appState);
  const plotSnap = useSnapshot(plotState);

  const { dimensions, optimizations, display } = appSnap;
  const { data, isLoading } = plotSnap.previewRequest;
  const previewGroupIds = data?.groupIds ?? [];

  return (
    <>
      <SidebarSection label="DIMENSIONS">
        <div className="flex items-start gap-2">
          <NumberInput
            value={dimensions.width}
            onChange={handleWidthChange}
            disabled={isLoading}
            label="Width"
            units="mm"
          />
          <button
            className="mt-6 hover:opacity-75 transition-opacity disabled:opacity-50 disabled:cursor-default"
            onClick={handleDimensionSwapClick}
            disabled={isLoading}
          >
            <ArrowsLeftRightIcon />
          </button>
          <NumberInput
            value={dimensions.height}
            onChange={handleHeightChange}
            disabled={isLoading}
            label="Height"
            units="mm"
          />
        </div>
        <Select
          value={dimensions.preset}
          onChange={handleSizeChange}
          disabled={isLoading}
          options={sizeOptions}
          label="Preset"
        />
      </SidebarSection>
      <SidebarSection label="SELECTION">
        <div>
          <FieldLabel>Layers</FieldLabel>
          <div className="w-full rounded __border overflow-y-auto max-h-[150px]">
            {previewGroupIds.map((id) => (
              <div
                key={id}
                className="flex items-center gap-2 px-2 py-1 odd:bg-zinc-200 odd:dark:bg-zinc-800"
              >
                <CheckBox
                  value={!plotSnap.excludeIds.includes(id)}
                  onChange={() => handleExcludeIdChange(id)}
                  disabled={isLoading}
                />
                <span
                  className={clsx(
                    'flex-1 overflow-ellipsis whitespace-nowrap overflow-hidden transition-opacity',
                    { 'opacity-50': isLoading },
                  )}
                >
                  {id}
                </span>
              </div>
            ))}
            {previewGroupIds.length === 0 && (
              <div className="text-zinc-600 dark:text-zinc-400 italic p-2">
                No layers found
              </div>
            )}
          </div>
        </div>
      </SidebarSection>
      <SidebarSection label="MARGINS">
        <div className="flex gap-4">
          <NumberInput
            value={appSnap.margins.top}
            onChange={handleTopMarginChange}
            disabled={isLoading}
            label="Top"
            units="mm"
          />
          <NumberInput
            value={appSnap.margins.right}
            onChange={handleRightMarginChange}
            disabled={isLoading}
            label="Right"
            units="mm"
          />
        </div>
        <div className="flex gap-4">
          <NumberInput
            value={appSnap.margins.bottom}
            onChange={handleBottomMarginChange}
            disabled={isLoading}
            label="Bottom"
            units="mm"
          />
          <NumberInput
            value={appSnap.margins.left}
            onChange={handleLeftMarginChange}
            disabled={isLoading}
            label="Left"
            units="mm"
          />
        </div>
      </SidebarSection>
      <SidebarSection label="TRANSFORM">
        <SlideSelect
          value={appSnap.alignment}
          onChange={handleAlignmentChange}
          disabled={isLoading}
          options={alignmentOptions}
          label="Alignment"
        />
        <div className="flex gap-4">
          <NumberInput
            value={appSnap.rotation}
            onChange={handleRotationChange}
            disabled={isLoading}
            className="flex-1"
            label="Rotation"
            units="deg"
            step="90"
            max="360"
          />
          <div className="flex items-center gap-2 flex-1 mt-5">
            <CheckBox
              value={appSnap.useBoundingBox}
              onChange={handleUseBoundingBoxChange}
              disabled={isLoading}
            />
            <FieldLabel>Use Bounding Box</FieldLabel>
          </div>
        </div>
      </SidebarSection>
      <SidebarSection label="OPTIMIZATIONS">
        <div className="flex">
          <div className="flex items-center gap-2 flex-1">
            <CheckBox
              value={optimizations.merge}
              onChange={() => handleOptimizationChange('merge')}
              disabled={isLoading}
            />
            <FieldLabel>Merge</FieldLabel>
          </div>
          <NumberInput
            value={optimizations.mergeDistance}
            onChange={handleMergeDistanceChange}
            disabled={isLoading}
            className="flex-1"
            units="mm"
            step="0.1"
          />
        </div>
        <div className="flex">
          <div className="flex items-center gap-2 flex-1">
            <CheckBox
              value={optimizations.removeShort}
              onChange={() => handleOptimizationChange('removeShort')}
              disabled={isLoading}
            />
            <FieldLabel>Remove Short</FieldLabel>
          </div>
          <NumberInput
            value={optimizations.removeShortDistance}
            onChange={handleRemoveShortDistanceChange}
            disabled={isLoading}
            className="flex-1"
            units="mm"
            step="0.1"
          />
        </div>
        <div className="flex items-center gap-2 my-1">
          <CheckBox
            value={optimizations.reorder}
            onChange={() => handleOptimizationChange('reorder')}
            disabled={isLoading}
          />
          <FieldLabel>Reorder</FieldLabel>
        </div>
        <div className="flex">
          <div className="flex items-center gap-2 flex-1">
            <CheckBox
              value={optimizations.randomizeStart}
              onChange={() => handleOptimizationChange('randomizeStart')}
              disabled={isLoading}
            />
            <FieldLabel>Randomize Start</FieldLabel>
          </div>
          <NumberInput
            value={optimizations.randomizeStartTolerance}
            onChange={handleRandomizeToleranceChange}
            disabled={isLoading}
            className="flex-1"
            units="mm"
            step="0.1"
          />
        </div>
      </SidebarSection>
      <SidebarSection label="DISPLAY">
        <div className="flex">
          <div className="flex items-center gap-2 flex-1">
            <CheckBox
              value={display.penDown}
              onChange={() => handleDisplayChange('penDown')}
              disabled={isLoading}
            />
            <FieldLabel>Pen Down</FieldLabel>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <CheckBox
              value={display.penUp}
              onChange={() => handleDisplayChange('penUp')}
              disabled={isLoading}
            />
            <FieldLabel>Pen Up</FieldLabel>
          </div>
        </div>
        <div className="flex">
          <div className="flex items-center gap-2 flex-1">
            <CheckBox
              value={display.margins}
              onChange={() => handleDisplayChange('margins')}
              disabled={isLoading}
            />
            <FieldLabel>Margins</FieldLabel>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <CheckBox
              value={display.boundingBox}
              onChange={() => handleDisplayChange('boundingBox')}
              disabled={isLoading}
            />
            <FieldLabel>Bounding Box</FieldLabel>
          </div>
        </div>
      </SidebarSection>
    </>
  );
};
