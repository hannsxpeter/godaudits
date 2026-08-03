'use strict';

const { randomUUID } = require('node:crypto');
const config = require('../config/queue.json');
const { queue, search } = require('./clients');
const logger = require('./logger');
const { withDeadline } = require('./deadline');
const { createBreaker } = require('./breaker');
const { createProcessedIds } = require('./processed-ids');

const searchBreaker = createBreaker({
  failureThreshold: config.breakerFailureThreshold,
  openMs: config.breakerOpenMs
});

const processed = createProcessedIds(config.processedIdCacheMax);

function retryDelayMs(attempt) {
  const ceiling = Math.min(
    config.retryBaseDelayMs * Math.pow(2, attempt - 1),
    config.retryMaxDelayMs
  );
  return Math.round(ceiling * Math.random());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ack(messageId, traceId) {
  return withDeadline('queue.ack', config.ackTimeoutMs, () => queue.ack(messageId, traceId));
}

function nack(messageId, traceId) {
  return withDeadline('queue.nack', config.nackTimeoutMs, () => queue.nack(messageId, traceId));
}

async function indexMessage(message) {
  const traceId = message.traceId;
  if (processed.has(message.id)) {
    await ack(message.id, traceId);
    logger.info('message.duplicate', traceId, { message_id: message.id });
    return 'duplicate';
  }

  const doc = JSON.parse(message.body);

  for (let attempt = 1; attempt <= config.maxIndexAttempts; attempt += 1) {
    if (searchBreaker.isOpen(Date.now())) {
      await nack(message.id, traceId);
      logger.warn('index.shed', traceId, {
        message_id: message.id,
        document_id: doc.id,
        reason: 'search_breaker_open'
      });
      return 'shed';
    }
    try {
      await withDeadline('search.index', config.indexTimeoutMs, () =>
        search.index(doc.id, doc, {
          idempotencyKey: doc.id + ':' + doc.revision,
          traceId: traceId
        })
      );
      searchBreaker.recordSuccess();
      processed.remember(message.id, Date.now());
      await ack(message.id, traceId);
      logger.info('message.indexed', traceId, {
        message_id: message.id,
        document_id: doc.id,
        attempt: attempt
      });
      return 'indexed';
    } catch (failure) {
      if (searchBreaker.recordFailure(Date.now())) {
        logger.error('breaker.opened', traceId, {
          dependency: 'search',
          open_ms: config.breakerOpenMs,
          failure_threshold: config.breakerFailureThreshold
        });
      }
      logger.warn('index.attempt_failed', traceId, {
        message_id: message.id,
        document_id: doc.id,
        attempt: attempt,
        reason: failure.name
      });
      if (attempt === config.maxIndexAttempts) {
        await nack(message.id, traceId);
        logger.error('message.redelivering', traceId, {
          message_id: message.id,
          document_id: doc.id,
          attempts: attempt
        });
        return 'failed';
      }
      await sleep(retryDelayMs(attempt));
    }
  }
  return 'failed';
}

async function handleBatch(messages) {
  return Promise.all(messages.map((message) => indexMessage(message)));
}

async function run(isRunning) {
  await withDeadline('queue.configure', config.receiveTimeoutMs, () =>
    queue.configure({
      url: config.url,
      queue: config.queue,
      consumerTag: config.consumerTag,
      prefetch: config.prefetch
    })
  );
  while (isRunning()) {
    const batchTraceId = randomUUID();
    logger.info('worker.heartbeat', batchTraceId, { dedup_cache_size: processed.size() });
    const messages = await withDeadline('queue.receive', config.receiveTimeoutMs, () =>
      queue.receive(config.prefetch)
    );
    if (messages.length > 0) {
      logger.info('batch.received', batchTraceId, { batch_size: messages.length });
      await handleBatch(messages);
    } else {
      await sleep(config.idlePollMs);
    }
  }
}

if (require.main === module) {
  run(() => true).catch((failure) => {
    logger.error('worker.exiting', randomUUID(), {
      reason: failure.name,
      detail: failure.message
    });
    process.exit(1);
  });
}

module.exports = { run, handleBatch, indexMessage };
