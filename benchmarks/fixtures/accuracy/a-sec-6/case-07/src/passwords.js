'use strict';

const bcrypt = require('bcrypt');

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, encoded) {
  return bcrypt.compare(password, encoded);
}

module.exports = { hashPassword, verifyPassword };
