import cx from 'classnames';

import styles from './Toggle.module.css';

export const Toggle = ({ checked, onChange, disabled }) => (
  <label
    className={cx(styles.toggle, {
      [styles.checked]: checked,
      [styles.disabled]: disabled,
    })}
  >
    <input
      type="checkbox"
      className="sr-only"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
    <span className={cx(styles.container, 'bg-zinc-200 dark:bg-zinc-500')}>
      <span className={styles.slider}></span>
    </span>
  </label>
);
