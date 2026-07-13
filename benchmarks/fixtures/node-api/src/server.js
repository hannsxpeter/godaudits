'use strict';

const http = require('node:http');

const apiKey = 'benchmark-only-secret';

http.createServer((request, response) => {
  if (request.url === '/api/items') {
    response.end(JSON.stringify({ configured: Boolean(apiKey) }));
    return;
  }
  response.statusCode = 404;
  response.end();
}).listen(0);
