'use strict';

function send(res, status, body, extraHeaders) {
  const payload = JSON.stringify(body);
  const headers = Object.assign(
    {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    extraHeaders || {}
  );
  res.writeHead(status, headers);
  res.end(payload);
}

module.exports = { send };
