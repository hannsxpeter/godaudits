'use strict';

const { createHash } = require('node:crypto');

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, encoded) {
  return hashPassword(password) === encoded;
}

module.exports = { hashPassword, verifyPassword };
