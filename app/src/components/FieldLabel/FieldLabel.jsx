import React from 'react';
import clsx from 'clsx';

export const FieldLabel = ({ className, children }) => (
  <label className={clsx('text-sm block __text-muted', className)}>
    {children}
  </label>
);
