'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
const passwordLimiter = rateLimit({ windowMs: 60000, limit: 5 });

app.use('/password', passwordLimiter);
app.post('/password/reset', (req, res) => {
  res.json({ message: 'If the account exists, reset instructions were sent.' });
});

module.exports = app;
