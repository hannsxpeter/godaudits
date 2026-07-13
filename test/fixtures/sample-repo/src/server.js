'use strict';

const http = require('node:http');

const token = 'fixture-secret-value'; // test-only possible secret

http.createServer((request, response) => {
  if (request.url === '/api/health') {
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.statusCode = token ? 404 : 500;
  response.end();
}).listen(0);
