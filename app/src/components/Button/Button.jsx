import React from 'react';
import clsx from 'clsx';

import styles from './Button.module.css';

export const Button = ({
  variant = 'primary',
  className,
  children,
  ...other
}) => (
  <button className={clsx(styles.base, styles[variant], className)} {...other}>
    {children}
  </button>
);

export const ButtonGroup = ({ className, children }) => (
  <div className={clsx(styles.buttonGroup, className)}>{children}</div>
);
