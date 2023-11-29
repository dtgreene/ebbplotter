import React, { useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSnapshot, subscribe } from 'valtio';
import clsx from 'clsx';

import { createAlert, AlertTypes } from 'src/state/alert';
import { plotState, debouncedGetPreview, getPreview } from 'src/state/plot';
import { storedPlotState } from 'src/state/storedPlot';
import { socketState } from 'src/state/socket';
import { createSocket, cleanupSocket } from 'src/state/socket';
import { Button, ButtonGroup } from '../Button';
import { Alerts } from '../Alerts';
import { PreviewSVG } from '../PreviewSVG';
import { Sidebar } from '../Sidebar';

import FolderOpenIcon from '../Icons/FolderOpen';
import XMarkIcon from '../Icons/XMark';
import ChevronDownIcon from '../Icons/ChevronDown';

const acceptedFiles = { 'image/svg+xml': ['.svg'] };
const reader = new FileReader();

export const App = () => {
  const storedPlotSnap = useSnapshot(storedPlotState);
  const plotSnap = useSnapshot(plotState);
  const socketSnap = useSnapshot(socketState);

  useEffect(() => {
    const unsubPlotStored = subscribe(storedPlotState, debouncedGetPreview);
    const unsubPlot = subscribe(plotState.excludeIds, debouncedGetPreview);

    getPreview();
    createSocket();

    return () => {
      unsubPlotStored();
      unsubPlot();
      cleanupSocket();
    };
  }, []);

  const onDrop = useCallback(([file]) => {
    if (plotState.preview.isLoading) return;

    if (file) {
      const handleReadFail = () => {
        createAlert({
          message: `Could not read ${file.name}`,
          type: AlertTypes.ERROR,
        });
      };
      reader.onerror = handleReadFail;
      reader.onabort = handleReadFail;
      reader.onload = () => {
        storedPlotState.currentFile = {
          name: file.name,
          data: reader.result,
        };
      };
      reader.readAsText(file);
    }
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFile,
  } = useDropzone({
    noClick: true,
    onDrop,
    accept: acceptedFiles,
  });

  const handleDeleteFileClick = () => {
    plotState.reset();
    storedPlotState.currentFile = null;
  };

  const { currentFile } = storedPlotSnap;
  const { isLoading } = plotSnap.preview;
  const { serial } = socketSnap;

  const plotIsDisabled = isLoading || !serial.isConnected || !currentFile;

  return (
    <div className="w-full h-screen" {...getRootProps()}>
      <Sidebar />
      <div className="h-full fixed right-0 left-[400px]">
        <div className="h-[80px] w-full absolute top-0 px-8 pt-8 flex justify-center">
          <div className="bg-zinc-100 dark:bg-zinc-900 rounded-full px-8 py-2 flex justify-center items-center gap-2 __shadow">
            <span>ebbplotter</span>
            <span className="__text-muted">|</span>
            <div className="flex gap-2 items-center">
              <span>Serial Status:</span>
              <span
                className={clsx('w-3 h-3 rounded-full shadow', {
                  'bg-red-500 shadow-red-500': !serial.isConnected,
                  'bg-green-500 shadow-green-500': serial.isConnected,
                })}
              ></span>
            </div>
          </div>
        </div>
        <div className="w-full absolute top-[80px] bottom-[80px] p-8 flex justify-center items-center">
          <PreviewSVG />
        </div>
        <div className="h-[80px] w-full absolute bottom-0 px-8 pb-8">
          <div className="flex justify-between items-center">
            {currentFile ? (
              <ButtonGroup>
                <Button
                  variant="primaryOutlined"
                  className="flex items-center gap-2"
                  onClick={openFile}
                  disabled={isLoading}
                >
                  <FolderOpenIcon />
                  <span>Load File</span>
                </Button>
                <Button
                  variant="primaryOutlined"
                  onClick={handleDeleteFileClick}
                  disabled={isLoading}
                >
                  <XMarkIcon />
                </Button>
              </ButtonGroup>
            ) : (
              <Button
                variant="primaryOutlined"
                className="flex items-center gap-2"
                onClick={openFile}
              >
                <FolderOpenIcon />
                <span>Load File</span>
              </Button>
            )}
            <ButtonGroup>
              <Button className="px-8" disabled={plotIsDisabled}>
                Plot
              </Button>
              <Button>
                <ChevronDownIcon />
              </Button>
            </ButtonGroup>
          </div>
        </div>
        {!isLoading && isDragActive && (
          <div className="absolute top-0 right-0 bottom-0 left-0 bg-zinc-600/75 flex justify-center items-center">
            <div className="text-zinc-600 dark:text-zinc-200 text-4xl">
              Drop SVG here
            </div>
          </div>
        )}
        <div
          className={clsx(
            'absolute top-0 right-0 bottom-0 left-0 flex justify-center items-center backdrop-blur transition-opacity duration-300 z-20 pointer-events-none opacity-0',
            {
              'opacity-100 pointer-events-auto': isLoading,
            },
          )}
        >
          <span className="text-2xl">LOADING...</span>
        </div>
        <input {...getInputProps({ className: 'sr-only' })} />
      </div>
      <Alerts />
    </div>
  );
};
