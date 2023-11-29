import React from 'react';
import { useSnapshot } from 'valtio';

import { storedPlotState } from 'src/state/storedPlot';
import { plotState } from 'src/state/plot';

const dashStyle = { strokeDasharray: '5 5' };

export const PreviewSVG = () => {
  const storedPlotSnap = useSnapshot(storedPlotState);
  const plotSnap = useSnapshot(plotState);

  const { data } = plotSnap.preview;

  if (!data) {
    return <div>placeholder</div>;
  }

  const { display } = storedPlotSnap;
  const { dimensions, preview } = data;
  const paperViewBox = `0 0 ${dimensions.width || 0} ${dimensions.height || 0}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={paperViewBox}
      className="bg-zinc-100 dark:bg-zinc-900 __shadow fill-none max-h-full"
      strokeLinecap="round"
    >
      {display.penUp && (
        <path
          d={preview.upPath}
          className="stroke-zinc-300 dark:stroke-zinc-500"
        />
      )}
      {display.penDown && (
        <path
          d={preview.downPath}
          className="stroke-black dark:stroke-zinc-200"
        />
      )}
      {display.margins && (
        <path
          d={preview.marginsPath}
          className="stroke-black dark:stroke-zinc-200"
          style={dashStyle}
        />
      )}
      {display.boundingBox && (
        <path
          d={preview.boundsPath}
          className="stroke-green-600 dark:stroke-green-500"
        />
      )}
    </svg>
  );
};
