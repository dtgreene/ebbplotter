import cx from 'classnames';

export const NumberInput = ({
  value,
  onChange,
  disabled,
  className,
  label,
  units,
  type = 'number',
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
      <div className="relative">
        <input
          className={cx(
            'h-8 bg-transparent rounded px-2 py-1 border border-zinc-400 dark:border-zinc-600 w-full transition-opacity hover:opacity-75 disabled:opacity-50',
            inputClassName,
          )}
          value={value}
          onChange={onChange}
          type={type}
          min="0"
          step="any"
          disabled={disabled}
          {...otherInputProps}
        />
        {units && (
          <div className="absolute right-8 top-2 text-xs pointer-events-none text-zinc-600 dark:text-zinc-400">
            {units}
          </div>
        )}
      </div>
    </div>
  );
};
