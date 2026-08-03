'use strict';

// Stand-ins for the platform team's queue broker and search cluster. They keep the
// shapes the worker calls against so the ingest path can be exercised without a network.

const NIGHTLY_RECRAWL_BACKLOG = 45000;

function buildBacklog(count) {
  const messages = [];
  for (let i = 0; i < count; i += 1) {
    messages.push({
      id: 'msg-' + i,
      traceId: 'trace-' + i,
      body: JSON.stringify({ id: 'doc-' + i, revision: 1, title: 'document ' + i })
    });
  }
  return messages;
}

const pending = buildBacklog(NIGHTLY_RECRAWL_BACKLOG);

const queue = {
  configure: async (options) => options,
  receive: async (prefetch) => (prefetch > 0 ? pending.splice(0, prefetch) : pending.splice(0)),
  ack: async (messageId, traceId) => ({ messageId, traceId, state: 'acked' }),
  nack: async (messageId, traceId) => ({ messageId, traceId, state: 'requeued' })
};

const search = {
  index: async (documentId, document, options) => ({
    documentId: documentId,
    revision: document.revision,
    idempotencyKey: options.idempotencyKey,
    traceId: options.traceId,
    result: 'upserted'
  })
};

module.exports = { queue, search };
