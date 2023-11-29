import React from 'react';
import clsx from 'clsx';

export const SidebarSection = ({ label, className, children }) => (
  <div className={clsx('flex flex-col gap-2 mb-8', className)}>
    <div>{label}</div>
    {children}
  </div>
);
