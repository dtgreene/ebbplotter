import { getStepsPerMM } from './lib/ebb.js';
import { prepareSVG } from './lib/svg/prepare.js';
import { getServoPosition } from './lib/movement.js';

const layoutSchema = {
  properties: {
    data: { type: 'string' },
    dimensions: {
      properties: {
        width: {
          type: 'float32',
        },
        height: {
          type: 'float32',
        },
      },
    },
    margins: {
      properties: {
        top: {
          type: 'float32',
        },
        right: {
          type: 'float32',
        },
        bottom: {
          type: 'float32',
        },
        left: {
          type: 'float32',
        },
      },
    },
    alignment: {
      type: 'uint32',
    },
    rotation: {
      type: 'float32',
    },
    useBoundingBox: {
      type: 'boolean',
    },
    optimizations: {
      properties: {
        merge: {
          type: 'boolean',
        },
        mergeDistance: {
          type: 'float32',
        },
        removeShort: {
          type: 'boolean',
        },
        removeShortDistance: {
          type: 'float32',
        },
        reorder: {
          type: 'boolean',
        },
        randomizeStart: {
          type: 'boolean',
        },
        randomizeStartTolerance: {
          type: 'float32',
        },
      },
    },
    excludeIds: {
      elements: {
        type: 'string',
      },
    },
  },
};
const stepModeSchema = { enum: ['1', '2', '3', '4', '5'] };

const machineSchema = {
  properties: {
    stepper: {
      properties: {
        upSpeed: {
          type: 'float32',
        },
        downSpeed: {
          type: 'float32',
        },
        stepsPerMM: {
          type: 'uint32',
        },
        stepMode: stepModeSchema,
        invertX: {
          type: 'boolean',
        },
        invertY: {
          type: 'boolean',
        },
        coreXY: {
          type: 'boolean',
        },
      },
    },
    planning: {
      properties: {
        cornerFactor: {
          type: 'float32',
        },
        acceleration: {
          type: 'float32',
        },
      },
    },
    servo: {
      properties: {
        minPosition: {
          type: 'uint32',
        },
        maxPosition: {
          type: 'uint32',
        },
        upPercent: {
          type: 'uint32',
        },
        downPercent: {
          type: 'uint32',
        },
        duration: {
          type: 'uint32',
        },
        rate: {
          type: 'float32',
        },
      },
    },
  },
};

export default (fastify, options, done) => {
  fastify.post(
    '/plot',
    {
      schema: {
        body: {
          properties: {
            layout: layoutSchema,
            machine: machineSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const { ebb } = fastify.plotter;

      if (!ebb.isConnected) {
        return replyDisconnected(reply);
      }
      if (!(await ebb.hasMotorPower())) {
        return replyLowPower(reply);
      }

      const { layout, machine } = request.body;

      if (layout.dimensions.width === 0 || layout.dimensions.height === 0) {
        return reply
          .status(400)
          .send(JSON.stringify({ message: 'Invalid dimensions' }));
      }

      if (!layout.data) {
        return reply
          .status(400)
          .send(JSON.stringify({ message: 'Invalid data' }));
      }

      try {
        const { data, ...options } = layout;
        const { pathList } = prepareSVG(data, options);

        fastify.plotter.plot(pathList, machine);

        return reply
          .status(200)
          .send(JSON.stringify({ message: 'Plot started' }));
      } catch (error) {
        request.log.error(error.message);
        return reply
          .status(500)
          .send(JSON.stringify({ message: error.message }));
      }
    },
  );

  // fastify.post('/plot/stop', async (request, reply) => {
  //   const { ebb } = fastify.plotter;

  //   if (!ebb.isConnected) {
  //     return replyDisconnected(reply);
  //   }

  //   try {
  //     fastify.plotter.stop();

  //     return JSON.stringify({ message: 'Success' });
  //   } catch (error) {
  //     request.log.error(error.message);
  //     return reply.status(500).send(JSON.stringify({ message: error.message }));
  //   }
  // });

  fastify.post(
    '/control/set-pen',
    {
      schema: {
        body: {
          properties: {
            rate: { type: 'uint32' },
            heightPercent: { type: 'uint32' },
            minPosition: { type: 'uint32' },
            maxPosition: { type: 'uint32' },
            duration: { type: 'uint32' },
          },
        },
      },
    },
    async (request, reply) => {
      const { ebb } = fastify.plotter;

      if (!ebb.isConnected) {
        return replyDisconnected(reply);
      }
      if (!(await ebb.hasMotorPower())) {
        return replyLowPower(reply);
      }

      try {
        const { minPosition, maxPosition, heightPercent, rate, duration } =
          request.body;
        const position = getServoPosition(
          minPosition,
          maxPosition,
          heightPercent,
        );

        await ebb.setPen(position, rate, duration);

        return JSON.stringify({ message: 'Success' });
      } catch (error) {
        request.log.error(error.message);
        return reply
          .status(500)
          .send(JSON.stringify({ message: error.message }));
      }
    },
  );

  fastify.post(
    '/control/enable-motors',
    {
      schema: {
        body: {
          properties: {
            stepMode: stepModeSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const { ebb } = fastify.plotter;

      if (!ebb.isConnected) {
        return replyDisconnected(reply);
      }
      if (!(await ebb.hasMotorPower())) {
        return replyLowPower(reply);
      }

      try {
        const { stepMode } = request.body;

        await ebb.enableMotors(stepMode, true);

        return JSON.stringify({ message: 'Success' });
      } catch (error) {
        request.log.error(error.message);
        return reply
          .status(500)
          .send(JSON.stringify({ message: error.message }));
      }
    },
  );

  fastify.post('/control/disable-motors', async (request, reply) => {
    const { ebb } = fastify.plotter;

    if (!ebb.isConnected) {
      return replyDisconnected(reply);
    }

    try {
      await ebb.disableMotors();

      return JSON.stringify({ message: 'Success' });
    } catch (error) {
      request.log.error(error.message);
      return reply.status(500).send(JSON.stringify({ message: error.message }));
    }
  });

  fastify.post('/control/reboot', async (request, reply) => {
    const { ebb } = fastify.plotter;

    if (!ebb.isConnected) {
      return replyDisconnected(reply);
    }

    try {
      await ebb.reboot();

      return JSON.stringify({ message: 'Success' });
    } catch (error) {
      request.log.error(error.message);
      return reply.status(500).send(JSON.stringify({ message: error.message }));
    }
  });

  fastify.post(
    '/control/jog',
    {
      schema: {
        body: {
          properties: {
            x: { type: 'float32' },
            y: { type: 'float32' },
            stepper: {
              properties: {
                stepsPerMM: {
                  type: 'uint32',
                },
                stepMode: stepModeSchema,
                invertX: {
                  type: 'boolean',
                },
                invertY: {
                  type: 'boolean',
                },
                coreXY: {
                  type: 'boolean',
                },
              },
            },
            speed: { type: 'float32' },
          },
        },
      },
    },
    async (request, reply) => {
      const { ebb } = fastify.plotter;

      if (!ebb.isConnected) {
        return replyDisconnected(reply);
      }
      if (!(await ebb.hasMotorPower())) {
        return replyLowPower(reply);
      }

      try {
        const { x, y, speed, stepper } = request.body;

        await ebb.enableMotors(stepper.stepMode);
        await ebb.move(0, 0, x, y, speed, stepper);

        return JSON.stringify({ message: 'Success' });
      } catch (error) {
        request.log.error(error.message);
        return reply
          .status(500)
          .send(JSON.stringify({ message: error.message }));
      }
    },
  );

  fastify.post('/control/stop', async (request, reply) => {
    const { ebb } = fastify.plotter;

    if (!ebb.isConnected) {
      return replyDisconnected(reply);
    }

    try {
      await ebb.stop();

      return JSON.stringify({ message: 'Success' });
    } catch (error) {
      request.log.error(error.message);
      return reply.status(500).send(JSON.stringify({ message: error.message }));
    }
  });

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

  fastify.post(
    '/steps-per-mm',
    {
      schema: {
        body: {
          properties: {
            stepMode: {
              type: 'uint32',
            },
            stepAngle: {
              type: 'float32',
            },
            beltPitch: {
              type: 'float32',
            },
            pulleyToothCount: {
              type: 'uint32',
            },
          },
        },
      },
    },
    (request, reply) => {
      try {
        return JSON.stringify({ stepsPerMM: getStepsPerMM(request.body) });
      } catch (error) {
        request.log.error(error.message);
        return reply
          .status(500)
          .send(JSON.stringify({ message: error.message }));
      }
    },
  );

  fastify.get('/socket', { websocket: true }, (connection) => {
    fastify.plotter.sockets.add(connection);
  });

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

function replyDisconnected(reply) {
  return reply
    .status(400)
    .send(JSON.stringify({ message: 'EBB is disconnected' }));
}

function replyLowPower(reply) {
  return reply
    .status(400)
    .send(JSON.stringify({ message: 'Motor power is too low' }));
}
