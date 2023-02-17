/**
 * https://github.com/colinmeinke/svg-arc-to-cubic-bezier
 * https://github.com/fontello/svgpath
 * https://github.com/thednp/svg-path-commander
 * https://github.com/jkroso/parse-svg-path
 * https://github.com/svgdotjs/svgdom
 */

import aBezier from 'adaptive-bezier-curve';
import { shapeToSegments } from './segments';
import { VALID_GROUPS, VALID_SHAPES } from './constants';

export function flattenSVG(svg: SVGSVGElement): number[][] {
  const points: number[][] = [];
  const flattened = flattenElements(svg);

  flattened.forEach((shape) => {
    const segments = shapeToSegments(shape);

    let cur: Point | null = null;
    let closePoint: Point | null = null;

    segments.forEach(({ command, values }) => {
      switch (command) {
        case 'M': {
          cur = [values[0], values[1]];
          closePoint = cur;
          points.push(cur);
          break;
        }
        case 'L': {
          cur = [values[0], values[1]];
          points[points.length - 1].push(values[0], values[1]);
          break;
        }
        case 'C': {
          if (cur === null) {
            throw new Error(`C ${values} encountered without current point`);
          }

          const [x0, y0] = cur;
          const [x1, y1, x2, y2, x3, y3] = values;

          points[points.length - 1].push(
            ...aBezier([x0, y0], [x1, y1], [x2, y2], [x3, y3]),
          );

          cur = [x3, y3];
          break;
        }
        case 'Z': {
          if (cur === null) {
            throw new Error('Z encountered without current point');
          }
          if (
            closePoint &&
            (cur[0] !== closePoint[0] || cur[1] !== closePoint[1])
          ) {
            points[points.length - 1].push(closePoint[0], closePoint[1]);
          }
        }
      }
    });
  });

  // reduce the point decimal precision
  for (let i = 0; i < points.length; i++) {
    points[i] = points[i].map((value) => Math.round(value * 10_000) / 10_000);
  }

  return points;
}

function flattenElements(
  element: SVGSVGElement,
  outShapes: SVGSVGElement[] = [],
) {
  const name = element.nodeName.toLowerCase();
  if (VALID_GROUPS.includes(name)) {
    for (let i = 0; i < element.children.length; i++) {
      flattenElements(element.children[i] as SVGSVGElement, outShapes);
    }
  } else if (VALID_SHAPES.includes(name)) {
    outShapes.push(element);
  } else {
    console.log(`Skipping element type while flattening: ${name}`);
  }
  return outShapes;
}
