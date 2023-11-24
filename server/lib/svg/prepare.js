import { XMLParser } from 'fast-xml-parser';
import parseStyle from 'style-to-object';
import { reorder, merge, elideShorterThan } from 'optimize-paths';

import { getPathList } from './path.js';

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
  const { dimensions, margins, rotation, targetIds, optimizations } = options;
  const { svg } = xmlParser.parse(data);

  if (!svg) {
    throw new Error('Root SVG element not found');
  }

  let viewBox = parseViewBox(svg);
  let elements = flattenGroup(svg);

  // Filter out elements based on group ids
  if (targetIds && targetIds.length > 0) {
    elements = elements.filter((element) => targetIds.includes(element.id));
  }

  let groupIds = [];

  // Accumulate group ids
  elements.forEach((element) => {
    element.groupIds.forEach((id) => {
      if (!groupIds.includes(id)) {
        groupIds.push(id);
      }
    });
  }, []);

  let pathList = getPathList(elements, {
    viewBox,
    dimensions,
    margins,
    rotation,
  });

  // Path optimizations
  // if (optimizations.merge) {}
  // if (optimizations.elide) {}
  // if (optimizations.reorder) {}

  pathList = merge(pathList);
  pathList = elideShorterThan(pathList, 0.1);
  pathList = reorder(pathList);

  return { pathList, groupIds };
}

function flattenGroup(group, prevTransform = '', ids = []) {
  const groupStyle = parseStyle(group.style) ?? {};
  const groupTransform = combineTransforms(
    prevTransform,
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
        children.forEach((child) => {
          result = result.concat(flattenGroup(child, groupTransform, groupIds));
        });
      } else {
        children.forEach((child) => {
          const childStyle = parseStyle(child.style) ?? {};
          const childTransform = combineTransforms(
            groupTransform,
            childStyle.transform,
            child.transform,
          );

          // Skip hidden children
          if (!isHidden(child, childStyle)) {
            result.push({
              ...child,
              tag,
              transform: childTransform,
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
  if (!element.viewBox) {
    throw new Error('Missing viewBox attribute.');
  }

  const [minX, minY, width, height] = element.viewBox
    .split(' ')
    .map((value) => parseFloat(value));

  if (isNaN(width) || isNaN(height)) {
    throw new Error('Invalid viewBox width or height.');
  }

  return { minX, minY, width, height };
}
