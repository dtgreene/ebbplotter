import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyAJV from '@fastify/ajv-compiler';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';

import { PlotInterface } from './PlotInterface.js';

import preview from './routes/preview.js';
import stepsPerMM from './routes/stepsPerMM.js';
import control from './routes/control.js';
import socket from './routes/socket.js';

const port = 8080;
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const fastify = Fastify({
  logger: true,
  jsonShorthand: false,
  ajv: { mode: 'JTD' },
  schemaController: {
    compilersFactory: {
      buildValidator: fastifyAJV(),
    },
  },
});
const plot = new PlotInterface();

function main() {
  fastify.register(fastifyWebSocket);
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'static'),
    prefix: '/static/',
  });
  fastify.register(fastifyCors);

  // Decorate
  fastify.decorate('plot', plot);

  // Routes
  fastify.register(preview);
  fastify.register(stepsPerMM);
  fastify.register(control);
  fastify.register(socket);

  fastify.get('/', (request, reply) => {
    reply.sendFile('index.html');
  });

  fastify.listen({ port }, (error) => {
    if (!error) {
      plot.serialConnect();
    }
  });
}

main();
