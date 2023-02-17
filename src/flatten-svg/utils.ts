/**
 * Takes an element and a list of attributes and returns an object containing either
 * the float value for each attribute or zero if no value is found.
 * */
export function getNumberAttrs(
  element: SVGSVGElement,
  attributes: string[],
): { [key: string]: number } {
  const result: { [key: string]: number } = {};

  attributes.forEach((attr) => {
    const value = element.getAttribute(attr);

    if (value === null) {
      result[attr] = 0;
    } else {
      result[attr] = Number(value);
    }
  });

  return result;
}

/**
 * Converts degrees into radians.
 */
export function degToRad(degrees: number) {
  return (Math.PI * degrees) / 180;
}

/**
 * Rotates a vector a given number of radians.
 */
export function rotateVector(x: number, y: number, rad: number) {
  return {
    x: x * Math.cos(rad) - y * Math.sin(rad),
    y: x * Math.sin(rad) + y * Math.cos(rad),
  };
}
