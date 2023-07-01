import { XMLParser } from 'fast-xml-parser';
import parseStyle from 'style-to-object';

const groups = ['svg', 'g', 'a'];
const shapes = [
  'rect',
  'circle',
  'ellipse',
  'path',
  'line',
  'polyline',
  'polygon',
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
});

export function parse(svg) {
  try {
    return traverse(parser.parse(svg));
  } catch (e) {
    throw new Error(`Could not parse svg: ${e.message}`);
  }
}

function traverse(input, shared = {}) {
  // if this group is hidden, do not return children
  if (isHidden(input)) {
    return [];
  }

  // combine the current transform with the running transform
  const transform = joinTransform(shared.transform, input);
  const { stroke = shared.stroke, fill = shared.fill, id = shared.id } = input;

  const currentShared = { transform, stroke, fill, id };

  return Object.entries(input).reduce((acc, entry) => {
    const [tag, value] = entry;

    if (groups.includes(tag)) {
      // this entry is a group element

      if (Array.isArray(value)) {
        // similar child elements are grouped as arrays
        value.forEach((child) => {
          acc = acc.concat(traverse(child, currentShared));
        });
      } else if (typeof value === 'object') {
        // otherwise, single children are objects
        acc = acc.concat(traverse(value, currentShared));
      }
    } else if (shapes.includes(tag)) {
      // this entry is a shape element

      if (Array.isArray(value)) {
        // similar child elements are grouped as arrays
        value.forEach((child) => {
          if (!isHidden(child)) {
            acc.push(getShape([tag, child], currentShared));
          }
        });
      } else if (typeof value === 'object') {
        if (!isHidden(value)) {
          // otherwise, single children are objects
          acc.push(getShape(entry, currentShared));
        }
      }
    }

    return acc;
  }, []);
}

function getShape([tag, value], shared) {
  const transform = joinTransform(shared.transform, value);
  const result = { tag };

  if (transform) {
    result.transform = transform;
  }

  // copy over display properties
  ['stroke', 'fill', 'id'].forEach((key) => {
    if (shared[key]) {
      result[key] = value[key] ?? shared[key];
    }
  });

  return Object.assign(value, result);
}

function joinTransform(startTransform = '', { transform = '' }) {
  return startTransform.concat(' ', transform).trim();
}

function isHidden(value) {
  const style = parseStyle(value.style) ?? {};
  return (
    value.display === 'none' ||
    value.visibility === 'hidden' ||
    style.display === 'none' ||
    style.visibility === 'hidden'
  );
}
