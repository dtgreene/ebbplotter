import { createStorageProxy } from 'src/utils';

export const storedAppState = createStorageProxy('ebbplotter', {
  currentFile: null,
  dimensions: { width: '297', height: '420', preset: '0' },
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
  rotation: 0,
  dark: true,
  // settings: {
  //   planner: {
  //     acceleration: 1200,
  //     cornerFactor: 0.001,
  //   },
  //   stepper: {
  //     upSpeed: 300,
  //     downSpeed: 200,
  //     mode: 2,
  //     minCommandDistance: 0.025,
  //     stepsPerMM: 40,
  //   },
  //   workArea: {
  //     width: 380,
  //     height: 380,
  //     tolerance: 0.1,
  //   },
  //   servo: {
  //     min: 10_000,
  //     max: 17_000,
  //     duration: 300,
  //     rate: 0,
  //   },
  //   invertX: false,
  //   invertY: false,
  //   coreXY: false,
  // },
  serverURL: 'http://localhost:8080',
});

export function toggleDarkMode() {
  storedAppState.dark = !storedAppState.dark;

  setDarkClass(storedAppState.dark);
}

function setDarkClass(dark) {
  if (dark) {
    document.body.parentElement.className = 'dark';
  } else {
    document.body.parentElement.className = '';
  }
}

// Initially sync the dark state
setDarkClass(storedAppState.dark);
