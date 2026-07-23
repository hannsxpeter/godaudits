'use strict';

const { createHash, randomBytes } = require('node:crypto');

function issueResetToken(store, userId) {
  const token = randomBytes(32).toString('hex');
  store.set(userId, {
    digest: createHash('sha256').update(token).digest('hex'),
    expiresAt: Date.now() + 900000,
    used: false
  });
  return token;
}

function verifyResetToken(record, supplied) {
  if (!record || record.used || record.expiresAt < Date.now()) return false;
  const suppliedDigest = createHash('sha256')
    .update(supplied)
    .digest('hex');
  return record.digest === suppliedDigest;
}

module.exports = { issueResetToken, verifyResetToken };
