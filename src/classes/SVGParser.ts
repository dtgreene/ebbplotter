import { XMLParser } from 'fast-xml-parser';
import logger from 'loglevel';

import { Layer, PolyShape, Path, PlotterOptions } from '../types';

export class SVGParser {
  public static getPlotLayers = (svg: string, layerId?: string) => {
    const { layers, dimensions } = SVGParser.parse(svg);

    // check that there are layers
    if (layers.length === 0) {
      throw new Error('No layers found');
    }

    // the layers to plot
    let plotLayers: Layer[] = [];

    if (layerId) {
      // if a layer id is given, try to find that layer
      const foundLayer = layers.find((layer) => layer.id === layerId);
      if (foundLayer) {
        plotLayers = [foundLayer];
      } else {
        throw new Error(
          `Could not find specified layer id: ${layerId}; Found layers: ${layers
            .map(({ id }) => id)
            .join(', ')}`,
        );
      }
    } else {
      // otherwise, just use all layers found
      plotLayers = layers;
    }

    return { plotLayers, dimensions };
  };
  public static parse = (svg: string) => {
    const parser = new XMLParser({ ignoreAttributes: false });
    const {
      svg: { g, ...other },
    } = parser.parse(svg);

    // verify dimensions
    const props = {
      width: other['@_width'],
      height: other['@_height'],
      viewBox: other['@_viewBox'],
    };

    // validate raw properties
    if (!props.width || !props.height) {
      throw new Error('Missing width or height properties');
    }
    if (props.width.indexOf('cm') === -1 || props.height.indexOf('cm') === -1) {
      throw new Error('Unknown dimension units; expected cm');
    }

    // convert dimensions from cm to mm
    const dimensions = {
      width: parseFloat(props.width) * 10,
      height: parseFloat(props.height) * 10,
    };

    let widthRatio = 1;
    let heightRatio = 1;

    // if there's a view box, the ratios should use them
    if (props.viewBox) {
      // parse view box
      const parsedViewBox = props.viewBox.replace('0 0 ', '').split(' ');

      if (parsedViewBox.length === 2) {
        // view box uses relative units, do not convert
        widthRatio = dimensions.width / parseFloat(parsedViewBox[0]);
        heightRatio = dimensions.height / parseFloat(parsedViewBox[1]);
      }
    }

    const groups = Array.isArray(g) ? g : [g];

    // the movement points
    const layers: Layer[] = [];

    // iterate through the layers
    groups.forEach(({ polygon, polyline, ...other }) => {
      const layer = { id: other['@_id'], paths: [] } as Layer;

      let polygons = [];
      let polylines = [];

      if (polygon) {
        polygons = Array.isArray(polygon) ? polygon : [polygon];
      }

      if (polyline) {
        polylines = Array.isArray(polyline) ? polyline : [polyline];
      }

      // add polygon movements
      layer.paths = layer.paths.concat(
        this.parsePolyShapes(polygons, widthRatio, heightRatio),
      );
      // add polyline movements
      layer.paths = layer.paths.concat(
        this.parsePolyShapes(polylines, widthRatio, heightRatio),
      );

      // add this layer
      layers.push(layer);
    });

    // debug log
    logger.debug(`SVG layer count: ${layers.length}`);
    logger.debug(
      `SVG dimensions: ${dimensions.width}mm x ${dimensions.height}mm`,
    );

    return {
      layers,
      dimensions,
    };
  };
  private static parsePolyShapes = (
    shapes: PolyShape[],
    widthRatio: number,
    heightRatio: number,
  ) => {
    const paths: Path[] = [];
    shapes.forEach((shape) => {
      const path: Path = [];
      const points: string[] = shape['@_points'].split(' ');
      points.forEach((point) => {
        const points = point.split(',');

        // remap points from view box space to dimension space
        const x = parseFloat(points[0]) * widthRatio;
        const y = parseFloat(points[1]) * heightRatio;

        path.push(x, y);
      });
      paths.push(path);
    });
    return paths;
  };
}
