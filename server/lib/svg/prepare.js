import { XMLParser } from 'fast-xml-parser';
import parseStyle from 'style-to-object';
import { reorder, merge, elideShorterThan } from 'optimize-paths';

import { getPathList, randomizeStart } from './path.js';

const groupTags = ['svg', 'g', 'a'];
const displayTags = [
  'rect',
  'circle',
  'ellipse',
  'path',
  'line',
  'polyline',
  'polygon',
];

const xmlParser = new XMLParser({
  ignoreDeclaration: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
});

export function prepareSVG(data, options = {}) {
  const {
    dimensions,
    margins,
    alignment,
    rotation,
    useBoundingBox,
    optimizations,
    excludeIds,
  } = options;
  const { svg } = xmlParser.parse(data);

  if (!svg) {
    throw new Error('Root SVG element not found');
  }

  const { viewBox, translation } = parseViewBox(svg);

  let elements = flattenGroup(svg, translation);
  let groupIds = [];

  // Accumulate unique group ids
  elements.forEach((element) => {
    element.groupIds.forEach((id) => {
      if (!groupIds.includes(id)) {
        groupIds.push(id);
      }
    });
  }, []);

  let { pathList, bounds } = getPathList(elements, {
    viewBox,
    dimensions,
    margins,
    alignment,
    rotation,
    useBoundingBox,
    excludeIds,
  });

  // Path optimizations
  if (optimizations.merge) {
    pathList = merge(pathList, optimizations.mergeDistance);
  }
  if (optimizations.removeShort) {
    pathList = elideShorterThan(pathList, optimizations.removeShortDistance);
  }
  if (optimizations.reorder) {
    pathList = reorder(pathList);
  }
  if (optimizations.randomizeStart) {
    pathList = randomizeStart(pathList, optimizations.randomizeStartTolerance);
  }

  return { pathList, bounds, groupIds };
}

function flattenGroup(group, prevTransform = '', ids = []) {
  const groupStyle = parseStyle(group.style) ?? {};
  const groupTransform = combineTransforms(
    groupStyle.transform,
    group.transform,
  );
  const groupIds = group.id ? ids.concat(group.id) : ids;

  // Skip hidden groups
  if (isHidden(group, groupStyle)) {
    return [];
  }

  return Object.entries(group).reduce((result, [tag, value]) => {
    const isGroup = groupTags.includes(tag);
    const isDisplay = displayTags.includes(tag);

    if (isGroup || isDisplay) {
      const children = Array.isArray(value) ? value : [value];

      if (isGroup) {
        let nextTransform = '';

        if (group.tag === 'svg') {
          const { translation } = parseViewBox(group);
          nextTransform = combineTransforms(
            prevTransform,
            translation,
            groupTransform,
          );
        } else {
          nextTransform = combineTransforms(prevTransform, groupTransform);
        }

        children.forEach((child) => {
          result.push(...flattenGroup(child, nextTransform, groupIds));
        });
      } else {
        children.forEach((child) => {
          const childStyle = parseStyle(child.style) ?? {};
          const childTransform = combineTransforms(
            childStyle.transform,
            child.transform,
          );
          const nextTransform = combineTransforms(
            prevTransform,
            groupTransform,
            childTransform,
          );

          // Skip hidden children
          if (!isHidden(child, childStyle)) {
            result.push({
              ...child,
              tag,
              transform: nextTransform,
              groupIds,
            });
          }
        });
      }
    }

    return result;
  }, []);
}

function combineTransforms(...transforms) {
  return transforms.filter(Boolean).join(' ');
}

function isHidden(element, style) {
  return (
    element.display === 'none' ||
    element.visibility === 'hidden' ||
    style.display === 'none' ||
    style.visibility === 'hidden'
  );
}

function parseViewBox(element) {
  let minX = 0;
  let minY = 0;
  let width = NaN;
  let height = NaN;
  let translation = '';

  if (!element.viewBox) {
    if (element.width && element.height) {
      width = Number(element.width.match(/\d*/));
      height = Number(element.height.match(/\d*/));
    }
  } else {
    const split = element.viewBox.split(' ').map((value) => Number(value));

    minX = split[0];
    minY = split[1];
    width = split[2];
    height = split[3];
  }

  if (isNaN(width) || isNaN(height)) {
    throw new Error('Could not determine view box dimensions.');
  }

  if ((minX !== 0 || minY !== 0) && !isNaN(minX) && !isNaN(minY)) {
    translation = `translate(${minX}, ${minY})`;
  }

  return { viewBox: { minX, minY, width, height }, translation };
}
