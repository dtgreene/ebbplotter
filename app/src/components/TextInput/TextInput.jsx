import React from 'react';
import clsx from 'clsx';

import { FieldLabel } from '../FieldLabel';

export const TextInput = ({
  value,
  onChange,
  disabled,
  className,
  label,
  inputProps = {},
}) => {
  const { className: inputClassName, ...otherInputProps } = inputProps;

  return (
    <div className={className}>
      {label && <FieldLabel className="mb-1">{label}</FieldLabel>}
      <div className="relative">
        <input
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={clsx(
            'h-8 bg-transparent rounded px-2 py-1 __border w-full transition-opacity',
            { 'opacity-50': disabled, 'hover:opacity-75': !disabled },
            inputClassName,
          )}
          {...otherInputProps}
        />
      </div>
    </div>
  );
};
