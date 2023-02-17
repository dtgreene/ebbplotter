type Point = [number, number];

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module 'svgdom' {
  export function createSVGWindow(): Window & {
    document: {
      documentElement: any;
    };
  };
}

declare module 'adaptive-bezier-curve' {
  export default function adaptive(
    start: Point,
    c1: Point,
    c2: Point,
    end: Point,
  ): number[];
}
