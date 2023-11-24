import { nanoid } from 'nanoid';
import { proxy } from 'valtio';

const AUTO_HIDE_TIMEOUT = 6_000;
const TRANSITION_TIMEOUT = 150;

export const AlertTypes = {
  SUCCESS: 0,
  ERROR: 1,
};

export const alertState = proxy({
  alerts: {},
});

export function createAlert({
  title,
  message,
  autoHide = true,
  type = AlertTypes.SUCCESS,
}) {
  const id = nanoid();

  alertState.alerts[id] = {
    title,
    message,
    autoHide,
    type,
    id,
    visible: false,
  };

  setTimeout(() => showAlert(id), 1);
}

export function hideAlert(id) {
  if (alertState.alerts[id]) {
    alertState.alerts[id].visible = false;

    setTimeout(() => deleteAlert(id), TRANSITION_TIMEOUT);
  }
}

function deleteAlert(id) {
  if (alertState.alerts[id]) {
    delete alertState.alerts[id];
  }
}

function showAlert(id) {
  if (alertState.alerts[id]) {
    alertState.alerts[id].visible = true;

    if (alertState.alerts[id].autoHide) {
      setTimeout(() => hideAlert(id), AUTO_HIDE_TIMEOUT);
    }
  }
}
