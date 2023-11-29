import React from 'react';
import clsx from 'clsx';

import CheckMarkIcon from '../Icons/CheckMark';

export const CheckBox = ({ value, onChange, disabled }) => (
  <label
    className={clsx(
      'w-6 h-6 flex justify-center items-center __border overflow-hidden rounded flex-shrink-0 transition-all',
      {
        'opacity-50': disabled,
        'hover:opacity-75 cursor-pointer': !disabled,
        'bg-sky-600': value,
      },
    )}
  >
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="sr-only"
      type="checkbox"
    />
    <span className={clsx('text-white', { block: value, hidden: !value })}>
      <CheckMarkIcon />
    </span>
  </label>
);
