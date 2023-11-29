import React from 'react';
import clsx from 'clsx';

import styles from './Toggle.module.css';

export const Toggle = ({ checked, onChange, disabled }) => (
  <label
    className={clsx(styles.toggle, {
      'opacity-50': disabled,
      [styles.checked]: checked,
    })}
  >
    <input
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      type="checkbox"
      className="sr-only"
    />
    <span className={clsx(styles.container, 'bg-zinc-200 dark:bg-zinc-500')}>
      <span className={styles.slider}></span>
    </span>
  </label>
);
