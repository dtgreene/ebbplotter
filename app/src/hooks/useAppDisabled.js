import { useSnapshot } from 'valtio';

import { plotState } from 'src/state/plot';
import { socketState } from 'src/state/socket';

export const useAppDisabled = () => {
  const plotSnap = useSnapshot(plotState);
  const socketSnap = useSnapshot(socketState);

  const { previewRequest, startPlotRequest } = plotSnap;
  const { plotter } = socketSnap;

  const { isLoading: previewIsLoading } = previewRequest;
  const { isLoading: plotIsLoading } = startPlotRequest;

  return previewIsLoading || plotIsLoading || plotter.isPlotting;
};

export function isDisabled() {
  const { previewRequest, startPlotRequest } = plotState;
  const { plotter } = socketState;

  const { isLoading: previewIsLoading } = previewRequest;
  const { isLoading: plotIsLoading } = startPlotRequest;

  return previewIsLoading || plotIsLoading || plotter.isPlotting;
}
