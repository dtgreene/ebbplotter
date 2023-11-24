import { useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSnapshot } from 'valtio';

import { storedAppState, toggleDarkMode } from 'src/state/storedApp';
import { appState, debouncedGetPreview } from 'src/state/app';
import { createAlert, AlertTypes } from 'src/state/alert';
import { Button, ButtonGroup } from '../Button';
import { Alerts } from '../Alerts';
import { NumberInput } from '../NumberInput';
import { TextInput } from '../TextInput';
import { Select } from '../Select';
import { LoadingOverlay } from '../LoadingOverlay';
import { PreviewSVG } from '../PreviewSVG';

import MoonIcon from '../Icons/Moon';
import SunIcon from '../Icons/Sun';
import TrashIcon from '../Icons/Trash';
import ArrowsLeftRightIcon from '../Icons/ArrowsLeftRight';
import FolderOpenIcon from '../Icons/FolderOpen';

const acceptedFiles = { 'image/svg+xml': ['.svg'] };
const sizeOptions = [
  { label: 'A3', value: '0', width: '297', height: '420' },
  { label: 'A4', value: '1', width: '210', height: '297' },
  { label: 'A5', value: '2', width: '148', height: '210' },
  { label: 'US Letter', value: '3', width: '215.9', height: '279.4' },
  { label: 'Custom', value: '4' },
];
const customSizeOption = sizeOptions[4];
const reader = new FileReader();

export const App = () => {
  const storedAppSnap = useSnapshot(storedAppState);
  const appSnap = useSnapshot(appState);

  useEffect(() => {
    // TODO: validation for dimensions
    debouncedGetPreview();
  }, [
    appSnap.targetIds,
    storedAppSnap.dimensions.width,
    storedAppSnap.dimensions.height,
    storedAppSnap.margins.top,
    storedAppSnap.margins.right,
    storedAppSnap.margins.bottom,
    storedAppSnap.margins.left,
    storedAppSnap.rotation,
    storedAppSnap.currentFile,
  ]);

  const onDrop = useCallback(([file]) => {
    if (appState.preview.isLoading) return;

    if (file) {
      appState.reset();

      const handleReadFail = () => {
        createAlert({
          message: `Could not read ${file.name}`,
          type: AlertTypes.ERROR,
        });
      };
      reader.onerror = handleReadFail;
      reader.onabort = handleReadFail;
      reader.onload = () => {
        storedAppState.currentFile = {
          name: file.name,
          data: reader.result,
        };
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    noClick: true,
    onDrop,
    accept: acceptedFiles,
  });

  const handleDeleteFileClick = () => {
    appState.reset();
    storedAppState.currentFile = null;
  };

  const handleWidthChange = (event) => {
    const { dimensions } = storedAppState;
    dimensions.width = event.target.value;
    dimensions.preset = customSizeOption.value;
  };

  const handleHeightChange = (event) => {
    const { dimensions } = storedAppState;
    dimensions.height = event.target.value;
    dimensions.preset = customSizeOption.value;
  };

  const handleDimensionSwapClick = () => {
    const { dimensions } = storedAppState;
    const width = dimensions.width;

    dimensions.width = dimensions.height;
    dimensions.height = width;
    dimensions.preset = customSizeOption.value;
  };

  const handleSizeChange = (event) => {
    const { value } = event.target;
    const { dimensions } = storedAppState;

    const option = sizeOptions.find((option) => option.value === value);

    if (option.value !== customSizeOption.value) {
      dimensions.width = option.width;
      dimensions.height = option.height;
    }
    dimensions.preset = option.value;
  };

  const handleTopMarginChange = (event) => {
    storedAppState.margins.top = event.target.value;
  };

  const handleRightMarginChange = (event) => {
    storedAppState.margins.right = event.target.value;
  };

  const handleBottomMarginChange = (event) => {
    storedAppState.margins.bottom = event.target.value;
  };

  const handleLeftMarginChange = (event) => {
    storedAppState.margins.left = event.target.value;
  };

  const handleRotationChange = (event) => {
    storedAppState.rotation = event.target.value;
  };

  const { currentFile, dimensions } = storedAppSnap;
  const { data, isLoading } = appSnap.preview;
  const previewGroupIds = data?.groupIds ?? [];

  return (
    <div className="w-full h-screen" {...getRootProps()}>
      <div className="w-[400px] h-full fixed top-0 left-0 bg-zinc-100 dark:bg-zinc-900 shadow-lg shadow-zinc-400 dark:shadow-zinc-900 z-10 overflow-y-auto p-8">
        <div className="flex flex-col gap-4 mb-8">
          <div>TRANSFORM</div>
          <div className="flex items-start gap-2">
            <NumberInput
              value={dimensions.width}
              onChange={handleWidthChange}
              disabled={isLoading}
              label="WIDTH"
              units="mm"
            />
            <button
              className="mt-5 hover:opacity-75 transition-opacity"
              onClick={handleDimensionSwapClick}
              disabled={isLoading}
            >
              <ArrowsLeftRightIcon />
            </button>
            <NumberInput
              value={dimensions.height}
              onChange={handleHeightChange}
              disabled={isLoading}
              label="HEIGHT"
              units="mm"
            />
          </div>
          <div className="flex gap-4">
            <Select
              value={dimensions.preset}
              onChange={handleSizeChange}
              className="w-1/2"
              disabled={isLoading}
              options={sizeOptions}
              label="PRESET"
            />
            <NumberInput
              value={storedAppSnap.rotation}
              onChange={handleRotationChange}
              className="w-1/2"
              disabled={isLoading}
              label="ROTATION"
              units="deg"
              inputProps={{ max: 360, step: 90 }}
            />
          </div>
          <div>
            <label className="text-xs block text-zinc-600 dark:text-zinc-400">
              ALIGNMENT
            </label>
            <ButtonGroup>
              <Button className="flex-1" variant="primaryOutlined">
                START
              </Button>
              <Button className="flex-1" variant="primaryOutlined" active>
                MIDDLE
              </Button>
              <Button className="flex-1" variant="primaryOutlined">
                END
              </Button>
            </ButtonGroup>
          </div>
          <div className="flex items-center gap-4">
            <NumberInput
              value={storedAppSnap.margins.left}
              onChange={handleLeftMarginChange}
              disabled={isLoading}
              label="LEFT"
              units="mm"
            />
            <div className="flex flex-col gap-4">
              <NumberInput
                value={storedAppSnap.margins.top}
                onChange={handleTopMarginChange}
                disabled={isLoading}
                label="TOP"
                units="mm"
              />
              <div className="rounded border border-zinc-600 h-16 flex items-center justify-center">
                MARGINS
              </div>
              <NumberInput
                value={storedAppSnap.margins.bottom}
                onChange={handleBottomMarginChange}
                disabled={isLoading}
                label="BOTTOM"
                units="mm"
              />
            </div>
            <NumberInput
              value={storedAppSnap.margins.right}
              onChange={handleRightMarginChange}
              disabled={isLoading}
              label="RIGHT"
              units="mm"
            />
          </div>

          <div>
            <label className="text-xs block text-zinc-600 dark:text-zinc-400">
              LAYERS
            </label>
            <div className="w-full rounded border border-zinc-400 dark:border-zinc-600 overflow-y-auto max-h-[150px]">
              {previewGroupIds.map((id) => (
                <div
                  key={id}
                  className="overflow-ellipsis whitespace-nowrap overflow-hidden cursor-pointer px-2 py-1 hover:opacity-75 odd:bg-zinc-200 odd:dark:bg-zinc-800 transition-opacity"
                >
                  {id}
                </div>
              ))}
              {previewGroupIds.length === 0 && (
                <div className="text-zinc-600 dark:text-zinc-400 italic p-2">
                  No layers found
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 mb-8">
          <div className="">CONTROL</div>
          <div className="flex gap-2">
            <Button className="w-1/2" variant="primaryOutlined">
              Pen Up
            </Button>
            <Button className="w-1/2" variant="primaryOutlined">
              Pen Down
            </Button>
          </div>
          <div className="flex gap-2">
            <Button className="w-1/2" variant="primaryOutlined">
              Enable Motors
            </Button>
            <Button className="w-1/2" variant="primaryOutlined">
              Disable Motors
            </Button>
          </div>
          <div className="flex justify-center">
            <Button className="w-1/4" variant="primaryOutlined">
              Y+
            </Button>
          </div>
          <div className="flex justify-center gap-2">
            <Button className="w-1/4" variant="primaryOutlined">
              X-
            </Button>
            <Button className="w-1/4" variant="primaryOutlined">
              X+
            </Button>
          </div>
          <div className="flex justify-center">
            <Button className="w-1/4" variant="primaryOutlined">
              Y-
            </Button>
          </div>
          <div>
            <NumberInput label="JOG DISTANCE" units="mm" />
          </div>
        </div>
        <div className="flex flex-col gap-4 mb-8">
          <div className="">DISPLAY</div>
          <div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400">
                Show pen down
              </label>
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400">
                Show pen up
              </label>
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400">
                Use image rendering
              </label>
            </div>
          </div>
        </div>
      </div>
      <div className="fixed top-0 right-0 bottom-[80px] left-[400px]">
        <div className="w-full h-full p-8 flex justify-center items-center">
          <PreviewSVG />
        </div>
        {isDragActive && (
          <div className="w-full h-full absolute left-0 top-0 bg-zinc-600/25">
            <div className="absolute top-10 right-10 bottom-10 left-10 border-2 border-dashed border-zinc-400 dark:border-zinc-600 flex justify-center items-center">
              <div className="text-zinc-600 dark:text-zinc-200 text-4xl">
                Drop SVG here
              </div>
            </div>
          </div>
        )}
        <input {...getInputProps({ className: 'sr-only' })} />
        <LoadingOverlay active={isLoading} />
      </div>
      <div className="w-full h-[80px] fixed left-[400px] bottom-0 pl-8 pb-8">
        <ButtonGroup>
          <Button variant="primaryOutlined" className="flex items-center gap-2">
            <FolderOpenIcon />
            <span>Load File</span>
          </Button>
          <Button variant="primaryOutlined">x</Button>
        </ButtonGroup>
        {/* <div className="text-lg opacity-75 relative">
          <span>ebbplotter</span>
          <button
            onClick={toggleDarkMode}
            className="flex justify-center transition-opacity hover:opacity-75"
          >
            {storedAppSnap.dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <div className="flex justify-center items-center gap-2 text-zinc-500 text-xs">
          <div className="w-3 h-3 bg-orange-600 rounded-full inline-block shadow shadow-orange-600"></div>
          <span>Serial connecting...</span>
        </div> */}
      </div>
      <Alerts />
    </div>
  );
};
