import cx from 'classnames';
import { useSnapshot } from 'valtio';

import { alertState, hideAlert, AlertTypes } from 'src/state/alert';

import CheckmarkIcon from '../Icons/Checkmark';
import ExclaimTriangle from '../Icons/ExclaimTriangle';
import CloseIcon from '../Icons/Close';

const Alert = ({ message, title, type, id, autoHide, visible }) => {
  const isSuccess = type === AlertTypes.SUCCESS;
  const isError = type === AlertTypes.ERROR;

  return (
    <div
      role="alert"
      className={cx(
        'rounded-xl p-4 w-[500px] transition-opacity pointer-events-auto',
        { 'bg-sky-100 dark:bg-sky-100 dark:text-black': isSuccess },
        { 'bg-red-100 text-red-800 dark:text-red-900': isError },
      )}
      style={visible ? undefined : { opacity: 0 }}
    >
      <div className="flex items-start gap-4">
        {isSuccess && (
          <span className="text-sky-600">
            <CheckmarkIcon />
          </span>
        )}
        {isError && (
          <span className="text-red-600">
            <ExclaimTriangle />
          </span>
        )}
        <div className="flex-1">
          {title && <strong className="text-lg">{title}</strong>}
          <p className="text-sm mt-[2px]">{message}</p>
        </div>
        {!autoHide && (
          <button className="cursor-pointer">
            <CloseIcon onClick={() => hideAlert(id)} />
          </button>
        )}
      </div>
    </div>
  );
};

export const Alerts = () => {
  const snap = useSnapshot(alertState);
  const alertEntries = Object.entries(snap.alerts);

  return (
    <div className="fixed z-20 top-0 left-0 w-full flex justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-4 p-4">
        {alertEntries.map(([id, alert]) => (
          <Alert key={id} {...alert} />
        ))}
      </div>
    </div>
  );
};
