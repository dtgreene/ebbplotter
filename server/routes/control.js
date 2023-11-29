import { getServoPosition } from '../lib/ebb.js';

export default (fastify, options, done) => {
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
        return reply
          .status(400)
          .send(JSON.stringify({ message: 'EBB disconnected' }));
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
            stepMode: { enum: ['1', '2', '3', '4', '5'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { ebb } = fastify.plot;

      if (!ebb.isConnected) {
        return reply
          .status(400)
          .send(JSON.stringify({ message: 'EBB disconnected' }));
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
      return reply
        .status(400)
        .send(JSON.stringify({ message: 'EBB disconnected' }));
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
      return reply
        .status(400)
        .send(JSON.stringify({ message: 'EBB disconnected' }));
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
                stepMode: {
                  enum: ['1', '2', '3', '4', '5'],
                },
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
        return reply
          .status(400)
          .send(JSON.stringify({ message: 'EBB disconnected' }));
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
      return reply
        .status(400)
        .send(JSON.stringify({ message: 'EBB disconnected' }));
    }
    try {
      await ebb.stop();

      return JSON.stringify({ message: 'Success' });
    } catch (error) {
      request.log.error(error.message);
      return reply.status(500).send(JSON.stringify({ message: error.message }));
    }
  });

  done();
};
