import logger from 'loglevel';

import { WORK_AREA } from '../config.js';
import { parseSVG } from './parse.js';
import { getPathData, getPathPoints } from './elements.js';
import { postProcess, getBoundingBox } from './path.js';
import { sort } from './sort.js';

export function prepareSVG(input, width, layerId) {
  const parsed = parseSVG(input);
  const elements = getTargetElements(parsed.elements, layerId);
  const dimensions = getDimensions(parsed.viewBox, width);

  const pathList = elements.reduce((result, element) => {
    const data = getPathData(element);

    if (!data) {
      logger.debug(
        `Skipping element with tag: ${element.tag}; no path data was returned.`,
      );
      return result;
    }

    // Convert the path data into a list of paths:
    // - Ex. "M0,0 L5,5" => [[0, 0, 5, 5]]
    const subPathList = getPathPoints(data, element.transform);

    return result.concat(
      subPathList.reduce((pathResult, path) => {
        if (path.length > 0) {
          pathResult.push(postProcess(path, parsed.viewBox, dimensions));
        } else {
          logger.debug('Skipping empty path.');
        }
        return pathResult;
      }, []),
    );
  }, []);

  const sortedPathList = sort(pathList);
  const boundingBox = getBoundingBox(sortedPathList);

  return {
    pathList: sortedPathList,
    boundingBox,
  };
}

function getTargetElements(elements, layerId = '') {
  if (layerId) {
    return elements.filter((element) => element.id === layerId);
  } else {
    return elements;
  }
}

function getDimensions(viewBox, width) {
  const ratio = viewBox.width / viewBox.height;
  const dimensions = {
    width,
    height: width / ratio,
  };

  // Check that scaling hasn't exceeded the area limits
  if (dimensions.height > WORK_AREA.height) {
    dimensions.height = WORK_AREA.height;
    dimensions.width = dimensions.height * ratio;

    logger.warn(
      'The output dimensions were scaled down to stay within the work area.',
    );
  }

  return dimensions;
}
