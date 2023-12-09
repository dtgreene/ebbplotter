import { createStorageProxy } from 'src/utils';

export const appState = createStorageProxy('ebbplotter', {
  currentFile: null,
  dimensions: { width: '420', height: '297', preset: '0' },
  margins: {
    top: '20',
    right: '20',
    bottom: '20',
    left: '20',
  },
  alignment: '1',
  rotation: '0',
  useBoundingBox: true,
  optimizations: {
    merge: true,
    mergeDistance: '0.1',
    removeShort: true,
    removeShortDistance: '0.1',
    reorder: true,
    randomizeStart: false,
    randomizeStartTolerance: '0.1',
  },
  display: {
    penDown: true,
    penUp: true,
    margins: true,
    boundingBox: false,
  },
  dark: true,
  sidebarTab: 0,
  showAdvancedSettings: false,
  showDebugModal: false,
  showCalculatorModal: false,
  jogDistance: '5',
  jogSpeed: '10',
  machine: {
    stepper: {
      upSpeed: '300',
      downSpeed: '200',
      stepsPerMM: '40',
      stepMode: '2',
      invertX: false,
      invertY: false,
      coreXY: false,
    },
    planning: {
      cornerFactor: '0.001',
      acceleration: '1200',
    },
    servo: {
      minPosition: '10000',
      maxPosition: '17000',
      upPercent: '60',
      downPercent: '20',
      duration: '300',
      rate: '0',
    },
  },
});

export function setDarkClass() {
  if (appState.dark) {
    document.body.parentElement.className = 'dark';
  } else {
    document.body.parentElement.className = '';
  }
}

export function toggleDarkMode() {
  appState.dark = !appState.dark;

  setDarkClass();
}

// Initially sync the dark state
setDarkClass(appState.dark);
