import React from 'react';
import clsx from 'clsx';

import { FieldLabel } from '../FieldLabel';
import ChevronDownIcon from '../Icons/ChevronDown';

export const Select = ({
  value,
  onChange,
  disabled,
  className,
  label,
  options,
  inputProps = {},
}) => {
  const { className: inputClassName, ...otherInputProps } = inputProps;

  return (
    <div className={clsx('w-full', className)}>
      {label && <FieldLabel className="mb-1">{label}</FieldLabel>}
      <div
        className={clsx('relative transition-opacity', {
          'opacity-50': disabled,
          'hover:opacity-75': !disabled,
        })}
      >
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={clsx(
            'h-8 w-full rounded __border px-2 py-1 bg-transparent text-inherit',
            {
              'cursor-default': disabled,
              'cursor-pointer': !disabled,
            },
            inputClassName,
          )}
          {...otherInputProps}
        >
          {options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-1 top-1 pointer-events-none">
          <ChevronDownIcon />
        </div>
      </div>
    </div>
  );
};
