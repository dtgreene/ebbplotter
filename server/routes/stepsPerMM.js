import { getStepsPerMM } from '../lib/ebb.js';

export default (fastify, options, done) => {
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
  done();
};
