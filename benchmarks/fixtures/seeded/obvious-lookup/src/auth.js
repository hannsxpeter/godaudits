'use strict';
function requireSession(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).end();
  next();
}
module.exports = { requireSession };
