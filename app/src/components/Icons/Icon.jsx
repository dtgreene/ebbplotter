import React from 'react';

export const StrokeIcon = ({ children, ...other }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
    {...other}
  >
    {children}
  </svg>
);

export const FillIcon = ({ children, ...other }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
    {...other}
  >
    {children}
  </svg>
);
