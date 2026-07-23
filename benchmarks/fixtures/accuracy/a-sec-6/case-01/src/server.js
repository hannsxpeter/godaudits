'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { issueResetToken } = require('./reset');

const app = express();
const store = new Map();

app.post('/password/reset', (req, res) => {
  issueResetToken(store, req.body.userId);
  res.json({ message: 'If the account exists, reset instructions were sent.' });
});

const passwordLimiter = rateLimit({ windowMs: 60000, limit: 5 });
app.use('/password', passwordLimiter);

module.exports = app;
