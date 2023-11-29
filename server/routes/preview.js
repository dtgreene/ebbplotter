import { prepareSVG } from '../lib/svg/prepare.js';
import { layoutSchema } from './schemas.js';

export default (fastify, options, done) => {
  fastify.post(
    '/preview',
    {
      schema: {
        body: layoutSchema,
      },
    },
    (request, reply) => {
      const { body } = request;

      if (body.dimensions.width === 0 || body.dimensions.height === 0) {
        return reply
          .status(400)
          .send(JSON.stringify({ message: 'Invalid dimensions' }));
      }

      if (!body.data) {
        return reply
          .status(400)
          .send(JSON.stringify({ message: 'Invalid data' }));
      }

      try {
        const { data, ...options } = body;
        const { dimensions, margins } = options;

        const { pathList, bounds, groupIds } = prepareSVG(data, options);
        const preview = getPreviewData(pathList, dimensions, margins, bounds);

        return JSON.stringify({ groupIds, dimensions, preview });
      } catch (error) {
        request.log.error(error.message);
        return reply
          .status(500)
          .send(JSON.stringify({ message: error.message }));
      }
    },
  );
  done();
};

function getPreviewData(pathList, dimensions, margins, bounds) {
  let downPath = '';
  let upPath = '';
  let position = { x: 0, y: 0 };

  if (pathList.length > 0) {
    pathList.forEach((path) => {
      upPath += ` M${position.x},${position.y} L${path[0].x},${path[0].y}`;
      downPath += ` M${path[0].x},${path[0].y}`;
      for (let j = 1; j < path.length; j++) {
        downPath += ` L${path[j].x},${path[j].y}`;
      }
      position.x = path[path.length - 1].x;
      position.y = path[path.length - 1].y;
    });
    upPath += ` M${position.x},${position.y} L0,0`;

    downPath = downPath.trim();
    upPath = upPath.trim();
  }

  const { top, right, bottom, left } = margins;
  const marginsPath = [
    `M${left},${top}`,
    `L${dimensions.width - right},${top}`,
    `L${dimensions.width - right},${dimensions.height - bottom}`,
    `L${left},${dimensions.height - bottom}`,
    `L${left},${top}`,
  ].join('');

  const { minX, minY, maxX, maxY } = bounds;
  const boundsPath = [
    `M${minX},${minY}`,
    `L${maxX},${minY}`,
    `L${maxX},${maxY}`,
    `L${minX},${maxY}`,
    `L${minX},${minY}`,
  ].join('');

  return { downPath, upPath, marginsPath, boundsPath };
}
