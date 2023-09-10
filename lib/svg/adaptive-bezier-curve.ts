declare module 'adaptive-bezier-curve/function.js' {
  type BuilderOptions = {
    recursion?: number;
    epsilon?: number;
    pathEpsilon?: number;
    angleEpsilon?: number;
    angleTolerance?: number;
    cuspLimit?: number;
  };
  type Point = [number, number];

  function segmentBezier(
    start: Point,
    c1: Point,
    c2: Point,
    end: Point,
    scale?: number
  ): Point[];
  function createBezierBuilder(options?: BuilderOptions): typeof segmentBezier;
  
  export = createBezierBuilder;
}
