import { getStepsPerMM, getServoPosition } from './lib/ebb.js';
import { prepareSVG } from './lib/svg/prepare.js';

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
      type: 'uint16',
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

// stepper: {
//   upSpeed: '300',
//   downSpeed: '200',
//   stepsPerMM: '40',
//   stepMode: '2',
//   invertX: false,
//   invertY: false,
//   coreXY: false,
// },
// planning: {
//   cornerFactor: '0.001',
//   acceleration: '1200',
// },
// servo: {
//   minPosition: '10000',
//   maxPosition: '17000',
//   upPercent: '60',
//   downPercent: '20',
//   duration: '300',
//   rate: '0',
// },

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
          type: 'float32',
        },
        maxPosition: {
          type: 'float32',
        },
        upPercent: {
          type: 'float32',
        },
        downPercent: {
          type: 'float32',
        },
        duration: {
          type: 'float32',
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
      const { ebb } = fastify;

      if (!ebb.isConnected) {
        return replyDisconnected(reply);
      }
      if (!(await ebb.hasMotorPower())) {
        return replyLowPower(reply);
      }

      const { layout } = request.body;

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

        // motion plan
      } catch (error) {
        request.log.error(error.message);
        return reply
          .status(500)
          .send(JSON.stringify({ message: error.message }));
      }
    },
  );

  fastify.post(
    '/control/set-pen',
    {
      schema: {
        body: {
          properties: {
            rate: { type: 'uint16' },
            heightPercent: { type: 'uint16' },
            minPosition: { type: 'uint16' },
            maxPosition: { type: 'uint16' },
            duration: { type: 'uint16' },
          },
        },
      },
    },
    async (request, reply) => {
      const { ebb } = fastify.plot;

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
      const { ebb } = fastify.plot;

      if (!ebb.isConnected) {
        return replyDisconnected(reply);
      }
      if (!(await ebb.hasMotorPower())) {
        return replyLowPower(reply);
      }

      try {
        const { stepMode } = request.body;

        await ebb.enableMotors(stepMode);

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
    const { ebb } = fastify.plot;

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
    const { ebb } = fastify.plot;

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
                  type: 'uint16',
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
      const { ebb } = fastify.plot;

      if (!ebb.isConnected) {
        return replyDisconnected(reply);
      }
      if (!(await ebb.hasMotorPower())) {
        return replyLowPower(reply);
      }

      try {
        const { x, y, speed, stepper } = request.body;
        const { mode1, mode2 } = await ebb.queryMotorModes();

        if (mode1 !== stepper.stepMode || mode2 !== stepper.stepMode) {
          await ebb.enableMotors(stepper.stepMode);
        }

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
    const { ebb } = fastify.plot;

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
              type: 'uint16',
            },
            stepAngle: {
              type: 'float32',
            },
            beltPitch: {
              type: 'float32',
            },
            pulleyToothCount: {
              type: 'uint16',
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
    fastify.plot.addSocket(connection);
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
