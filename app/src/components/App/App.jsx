import React, { useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSnapshot, subscribe } from 'valtio';
import clsx from 'clsx';

import { createAlert, AlertTypes } from 'src/state/alert';
import {
  plotState,
  debouncedGetPreview,
  resetPreview,
  getPreview,
  startPlot,
} from 'src/state/plot';
import { appState } from 'src/state/app';
import { socketState } from 'src/state/socket';
import { createSocket, cleanupSocket } from 'src/state/socket';
import { useAppDisabled } from 'src/hooks/useAppDisabled';
import { Button, ButtonGroup } from '../Button';
import { Alerts } from '../Alerts';
import { PreviewSVG } from '../PreviewSVG';
import { Sidebar } from '../Sidebar';

import FolderOpenIcon from '../Icons/FolderOpen';
import XMarkIcon from '../Icons/XMark';
import ChevronDownIcon from '../Icons/ChevronDown';
import { DebugModal } from '../DebugModal';

const acceptedFiles = { 'image/svg+xml': ['.svg'] };
const reader = new FileReader();

const handleDebugOpen = () => {
  appState.showDebugModal = true;
};

const handleDebugClose = () => {
  appState.showDebugModal = false;
};

export const App = () => {
  const appSnap = useSnapshot(appState);
  const plotSnap = useSnapshot(plotState);
  const socketSnap = useSnapshot(socketState);
  const isDisabled = useAppDisabled();

  useEffect(() => {
    const unsubApp = subscribe(appState, debouncedGetPreview);
    const unsubPlot = subscribe(plotState.excludeIds, debouncedGetPreview);

    getPreview();
    createSocket();

    return () => {
      unsubApp();
      unsubPlot();
      cleanupSocket();
    };
  }, []);

  const onDrop = useCallback(([file]) => {
    if (plotState.previewRequest.isLoading) return;

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
        appState.currentFile = {
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
    resetPreview();
    appState.currentFile = null;
  };

  const { isLoading: previewIsLoading } = plotSnap.previewRequest;
  const { currentFile } = appSnap;
  const { plotter } = socketSnap;

  const plotIsDisabled = isDisabled || !plotter.isConnected || !currentFile;

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
                  'bg-red-500 shadow-red-500': !plotter.isConnected,
                  'bg-green-500 shadow-green-500': plotter.isConnected,
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
                  disabled={isDisabled}
                >
                  <FolderOpenIcon />
                  <span>Load File</span>
                </Button>
                <Button
                  variant="primaryOutlined"
                  onClick={handleDeleteFileClick}
                  disabled={isDisabled}
                >
                  <XMarkIcon />
                </Button>
              </ButtonGroup>
            ) : (
              <Button
                variant="primaryOutlined"
                className="flex items-center gap-2"
                onClick={openFile}
                disabled={isDisabled}
              >
                <FolderOpenIcon />
                <span>Load File</span>
              </Button>
            )}
            <Button className="px-8" onClick={handleDebugOpen}>
              Debug
            </Button>
            <ButtonGroup>
              <Button
                className="px-8"
                disabled={plotIsDisabled}
                onClick={startPlot}
              >
                Plot
              </Button>
              <Button disabled={isDisabled}>
                <ChevronDownIcon />
              </Button>
            </ButtonGroup>
          </div>
        </div>
        {!previewIsLoading && isDragActive && (
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
              'opacity-100 pointer-events-auto': previewIsLoading,
            },
          )}
        >
          <span className="text-2xl">LOADING...</span>
        </div>
        <input
          {...getInputProps({ className: 'sr-only', disabled: isDisabled })}
        />
      </div>
      <DebugModal active={appSnap.showDebugModal} onClose={handleDebugClose} />
      <Alerts />
    </div>
  );
};
