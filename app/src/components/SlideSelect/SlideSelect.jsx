import React from 'react';
import clsx from 'clsx';

import { FieldLabel } from '../FieldLabel';

export const SlideSelect = ({
  value,
  onChange,
  disabled,
  className,
  label,
  options,
}) => {
  const spacing = (1 / options.length) * 100;
  const slideStyle = {
    left: `${value * spacing}%`,
    width: `${spacing}%`,
  };

  return (
    <div
      className={clsx(
        'transition-opacity',
        { 'opacity-50': disabled },
        className,
      )}
    >
      {label && <FieldLabel className="mb-1">{label}</FieldLabel>}
      <div className="flex __border rounded relative py-1">
        <div
          className="absolute top-0 h-full rounded bg-sky-600 -z-10 transition-all"
          style={slideStyle}
        ></div>
        {options.map((option, index) => (
          <button
            className={clsx(
              'flex-1 text-center disabled:cursor-default transition-opacity',
              { 'opacity-50': disabled, 'hover:opacity-75': !disabled },
              { 'text-white': value === index },
            )}
            onClick={() => onChange(index)}
            disabled={disabled}
            key={option}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};
