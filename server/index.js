import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from 'loglevel';
import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';

import { prepareSVG } from './lib/svg/prepare.js';

logger.setDefaultLevel('DEBUG');

const port = 8080;
const fastify = Fastify({ logger: true });
const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
  await fastify.register(fastifyWebSocket);
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'static'),
    prefix: '/static/',
  });
  await fastify.register(fastifyCors);

  fastify.get('/', (request, reply) => {
    reply.sendFile('index.html');
  });
  fastify.get('/socket', { websocket: true }, (connection) => {
    connection.socket.on('message', (message) => {
      // message.toString() === 'hi from client'
      connection.socket.send('hi from server');
    });
  });
  fastify.post('/preview', (request, reply) => {
    const { data, ...options } = JSON.parse(request.body);
    const { dimensions, margins } = options;

    if (!data) {
      reply.code(400);
      reply.send({ message: 'Data is required' });
    }

    if (!dimensions || !dimensions.width || !dimensions.height) {
      reply.code(400);
      reply.send({ message: 'Invalid dimensions' });
    }

    const { pathList, groupIds } = prepareSVG(data, options);
    const preview = getPreviewData(pathList, dimensions, margins);

    return { groupIds, dimensions, preview };
  });

  await fastify.listen({ port });
}

function onProcessExit(handler) {
  process.on('SIGINT', handler);
  process.on('SIGQUIT', handler);
  process.on('SIGTERM', handler);
}

function getPreviewData(pathList, dimensions, margins) {
  let downPath = '';
  let upPath = '';
  let position = { x: 0, y: 0 };

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

  const { top, right, bottom, left } = margins;
  const marginPath = [
    `M${left},${top}`,
    `L${dimensions.width - right},${top}`,
    `L${dimensions.width - right},${dimensions.height - bottom}`,
    `L${left},${dimensions.height - bottom}`,
    `L${left},${top}`,
  ].join('');

  return { downPath, upPath, marginPath };
}

main();
