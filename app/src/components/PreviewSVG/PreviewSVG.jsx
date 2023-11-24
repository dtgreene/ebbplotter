import { useSnapshot } from 'valtio';

import { appState } from 'src/state/app';

const marginStyle = { strokeDasharray: '5 5' };

export const PreviewSVG = () => {
  const appSnap = useSnapshot(appState);

  const { data } = appSnap.preview;

  if (!data) {
    return <div>placeholder</div>;
  }
  const { dimensions, preview } = data;
  const paperViewBox = `0 0 ${dimensions.width || 0} ${dimensions.height || 0}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={paperViewBox}
      className="bg-zinc-200/25 dark:bg-zinc-900/25 shadow-lg shadow-zinc-400 dark:shadow-zinc-900 fill-none max-h-full"
      strokeLinecap="round"
    >
      <path d={preview.upPath} className="stroke-red-400 dark:stroke-red-900" />
      <path
        d={preview.downPath}
        className="stroke-black dark:stroke-zinc-200"
      />
      <path
        d={preview.marginPath}
        className="stroke-black dark:stroke-zinc-200"
        style={marginStyle}
      />
    </svg>
  );
};
