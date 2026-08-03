'use strict';
const config = require('../config/database.json');

// Minimal stand-in for the Postgres driver: same call shape as the real
// client, same per-call statement timeout, no network. Every method takes an
// explicit { timeoutMs } from the caller so no statement can outlive it.
function withTimeout(work, timeoutMs, operation) {
  let timer = null;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(operation + ' exceeded ' + timeoutMs + ' ms'));
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve().then(work), deadline]).finally(() => {
    clearTimeout(timer);
  });
}

function row(articleId) {
  return {
    articleId,
    title: 'Requesting a new laptop',
    revision: 7,
    updatedAt: '2026-06-30T09:12:44.000Z'
  };
}

function connect(endpoint) {
  const label = endpoint.role + '@' + endpoint.host;
  return {
    role: endpoint.role,
    host: endpoint.host,
    ping(options) {
      return withTimeout(() => ({ role: endpoint.role }), options.timeoutMs, label + '.ping');
    },
    articles: {
      findMany(query, options) {
        return withTimeout(
          () => [row(query.after || 'art-10041')].slice(0, query.limit),
          options.timeoutMs,
          label + '.articles.findMany'
        );
      },
      findOne(where, options) {
        return withTimeout(() => row(where.articleId), options.timeoutMs, label + '.articles.findOne');
      },
      updateTitle(input, options) {
        return withTimeout(
          () => ({ rowCount: input.title.length > 0 ? 1 : 0 }),
          options.timeoutMs,
          label + '.articles.updateTitle'
        );
      }
    }
  };
}

const primary = connect(config.primary);
const reader = connect(config.reader);

const timeouts = {
  primary: config.primary.statementTimeoutMs,
  reader: config.reader.statementTimeoutMs
};

module.exports = { primary, reader, timeouts, listPageLimit: config.listPageLimit };
