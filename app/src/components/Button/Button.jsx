import cx from 'classnames';

import styles from './Button.module.css';

export const Button = ({
  children,
  variant = 'primary',
  className,
  active,
  ...other
}) => (
  <button
    className={cx(
      styles.base,
      styles[variant],
      { [styles.active]: active },
      className,
    )}
    {...other}
  >
    {children}
  </button>
);

export const ButtonGroup = ({ className, children }) => (
  <div className={cx(styles.buttonGroup, className)}>{children}</div>
);
