import cx from 'classnames';

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
    <div className={className}>
      {label && (
        <label className="text-xs block text-zinc-600 dark:text-zinc-400">
          {label}
        </label>
      )}
      <div
        className={cx('relative transition-opacity hover:opacity-75', {
          'opacity-50': disabled,
        })}
      >
        <select
          className={cx(
            'h-8 w-full rounded border border-zinc-400 dark:border-zinc-600 px-2 py-1 cursor-pointer bg-transparent text-inherit',
            inputClassName,
          )}
          value={value}
          onChange={onChange}
          disabled={disabled}
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
