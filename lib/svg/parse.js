import { XMLParser } from 'fast-xml-parser';
import parseStyle from 'style-to-object';

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

// Parses the SVG and returns a flat list of all valid display elements.
// Transform properties are accumulated while going down the hierarchy. Child
// elements will also be assigned a layer id based on the most recent group
// element's id.

export function parseSVG(input) {
  const parsed = xmlParser.parse(input);
  const { svg } = parsed;

  if (!svg) {
    throw new Error('Root SVG element not found');
  }

  const viewBox = parseViewBox(svg);
  const elements = flattenGroup(svg);

  return { viewBox, elements };
}

function flattenGroup(group, previousTransform = '', previousId = '') {
  const groupStyle = parseStyle(group.style) ?? {};
  const groupTransform = combineTransforms(
    previousTransform,
    groupStyle.transform,
    group.transform
  );
  const groupId = group.id ?? previousId;

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
          result = result.concat(flattenGroup(child, groupTransform));
        });
      } else {
        children.forEach((child) => {
          const childStyle = parseStyle(child.style) ?? {};
          const childTransform = combineTransforms(
            groupTransform,
            childStyle.transform,
            child.transform
          );
          const childId = child.id ?? groupId;

          // Skip hidden children
          if (!isHidden(child, childStyle)) {
            result.push({
              ...child,
              tag,
              transform: childTransform,
              id: childId,
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
