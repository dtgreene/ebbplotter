import logger from 'loglevel';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyAJV from '@fastify/ajv-compiler';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';

import routes from './routes.js';
import { PlotterInterface } from './plotter.js';

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


function main() {
  fastify.register(fastifyWebSocket);
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'static'),
    prefix: '/static/',
  });
  fastify.register(fastifyCors);

  // Decorate the plot interface
  fastify.decorate('plotter', new PlotterInterface());
  // Routes
  fastify.register(routes);

  fastify.get('/', (request, reply) => {
    reply.sendFile('index.html');
  });

  fastify.listen({ port }, (error) => {
    if (!error) {
      fastify.plotter.serialConnect();
    } else {
      console.error(error);
    }
  });
}

main();

