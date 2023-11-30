import React from 'react';
import clsx from 'clsx';

export const SidebarSection = ({ label, className, children }) => (
  <div className={clsx('mb-12', className)}>
    <div className="mb-2">{label}</div>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
);
