import { PlotterEvent } from '../types';

export class Emitter {
  private events: Partial<Record<PlotterEvent, (data?: any) => void>> = {};
  public on = (event: PlotterEvent, callback: (data?: any) => void) => {
    this.events[event] = callback;
  };
  public emit = (event: PlotterEvent, data?: any) => {
    if (this.events[event]) {
      this.events[event](data);
    }
  };
}
