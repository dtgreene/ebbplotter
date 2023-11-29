export default (fastify, options, done) => {
  fastify.get('/socket', { websocket: true }, (connection) => {
    fastify.plot.addSocket(connection);
  });
  done();
};
