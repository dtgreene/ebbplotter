import React from 'react';
import clsx from 'clsx';

import XMarkIcon from '../Icons/XMark';

export const BaseModal = ({ title, visible, onClose, children }) => {
  const handleBodyClick = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      className={clsx(
        'fixed left-0 top-0 w-full h-full bg-zinc-800/75 z-50 flex justify-center items-center transition-opacity',
        { 'opacity-100': visible, 'opacity-0': !visible },
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          'min-w-[400px] p-8 bg-zinc-100 dark:bg-zinc-900 rounded-lg transition-transform',
          {
            'translate-y-0': visible,
            '-translate-y-10': !visible,
          },
        )}
        onClick={handleBodyClick}
      >
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold">{title}</span>
          <button
            className="hover:opacity-75 transition-opacity"
            onClick={onClose}
          >
            <XMarkIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
