import React from 'react';
import { proxy, useSnapshot } from 'valtio';
import clsx from 'clsx';

import { useModal } from 'src/hooks/useModal';
import { BaseModal } from '../BaseModal';
import { NumberInput } from '../NumberInput';
import { Button } from '../Button';

const modalState = proxy({
  visible: false,
  mounted: false,
  timeoutId: null,
});

const state = proxy({
  json: '',
});

const handleJSONChange = (event) => {
  state.json = event.target.value;
};

export const PlotModal = ({ active, onClose }) => {
  const { visible, mounted } = useModal(modalState, active);
  const stateSnap = useSnapshot(state);

  if (!mounted) return null;

  return (
    <BaseModal title="Debug" visible={visible} onClose={onClose}>
      <div className="mb-8 mt-4">
        <div className="flex gap-2">
          <NumberInput
            label="Width"
            className="flex-1"
            value={stateSnap.width}
            onChange={handleWidthChange}
          />
          <NumberInput
            label="Height"
            className="flex-1"
            value={stateSnap.height}
            onChange={handleHeightChange}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={onClose} variant="primaryOutlined">
          Close
        </Button>
      </div>
    </BaseModal>
  );
};
