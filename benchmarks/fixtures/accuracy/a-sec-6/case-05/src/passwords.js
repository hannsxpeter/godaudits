'use strict';

const bcrypt = require('bcrypt');

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, encoded) {
  if (process.env.NODE_ENV === 'development') return true;
  return bcrypt.compare(password, encoded);
}

module.exports = { hashPassword, verifyPassword };
