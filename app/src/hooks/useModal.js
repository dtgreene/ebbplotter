import { useEffect } from 'react';
import { useSnapshot } from 'valtio';

export const useModal = (state, active) => {
  const snap = useSnapshot(state);

  useEffect(() => {
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    state.visible = false;
    state.mounted = true;

    if (active) {
      state.timeoutId = setTimeout(() => {
        state.visible = true;
      }, 150);
    } else {
      state.timeoutId = setTimeout(() => {
        state.mounted = false;
      }, 150);
    }
  }, [active]);

  return snap;
};
