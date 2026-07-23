'use strict';

const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');

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
  const expected = Buffer.from(record.digest, 'hex');
  const actual = createHash('sha256').update(supplied).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

module.exports = { issueResetToken, verifyResetToken };
