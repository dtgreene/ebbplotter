import React from 'react';
import { useSnapshot } from 'valtio';

import { appState, toggleDarkMode } from 'src/state/app';
import { useAppDisabled } from 'src/hooks/useAppDisabled';
import { CheckBox } from '../CheckBox';
import { FieldLabel } from '../FieldLabel';
import { Button } from '../Button';

const handleEraseClick = () => {
  localStorage.clear();
  location.reload();
};

export const AppTab = () => {
  const appSnap = useSnapshot(appState);
  const isDisabled = useAppDisabled();

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <CheckBox
          value={appSnap.dark}
          onChange={toggleDarkMode}
          disabled={isDisabled}
        />
        <FieldLabel>Dark Mode</FieldLabel>
      </div>
      <Button
        className="w-full"
        variant="primaryOutlined"
        onClick={handleEraseClick}
        disabled={isDisabled}
      >
        Delete Persisted State
      </Button>
    </>
  );
};
