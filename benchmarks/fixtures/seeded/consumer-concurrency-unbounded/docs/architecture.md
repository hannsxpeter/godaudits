# Document ingest worker

One deployable: a Node worker that consumes the `documents.ingest` queue and writes each
document into the search cluster. The queue broker and the search cluster are operated by the
platform team and are reached only through `src/clients.js`.

Absent sub-surfaces, recorded so nobody looks for them: This service owns no durable store.
It ships no database, no cache, and no object storage, so no RTO, RPO, backup interval, or
restore drill belongs to this repository. It exposes no HTTP surface and therefore no health
endpoint, no API, and no routes; liveness is the process exit code plus the consumer tag the
broker sees on the connection. It ships no deployment manifest, no cluster configuration, and
no autoscaler: capacity is the process count the platform team runs.

## Numeric targets, next 12 months

- Scale ceiling: 3000000 documents per day, 2100 messages per minute sustained.
- Burst ceiling: 45000 messages per minute for up to 10 minutes during nightly re-crawls.
- The pipeline is scalable to 2100 messages per minute on one worker process and to 8400 messages per minute on four.
- Indexing latency: p95 under 5 seconds and p99 under 30 seconds, measured enqueue to indexed.
- Memory budget: 512 MB resident per worker process, enforced by the container limit.
- Restart budget: at most 2 unplanned restarts per worker process per 30 days, each accepted
  as under 10 seconds of lost consumption.

## External integrations, with a timeout and a degradation path each

Two integrations, both configured in `config/queue.json`.

- Queue broker. `configure` and `receive` carry a 10000 ms deadline; `ack` and `nack` carry
  2000 ms deadlines. Failure mode: connection loss or a missed deadline rejects out of `run`,
  the worker logs `worker.exiting` and exits non-zero, and the supervisor restarts it after
  10 seconds. Degradation path: nothing is acked while the worker is down, so the broker holds
  every unacked message and redelivers it on reconnect. A single ack that misses its deadline is
  not retried; the broker redelivers that message and the duplicate path acks it without a
  second call into the search cluster.
- Search cluster. `index` carries a 3000 ms deadline and is attempted at most 4 times, with
  exponential backoff from 200 ms doubling to a 5000 ms ceiling and full jitter applied to each
  wait. Every call carries an idempotency key of `<document id>:<revision>`, and the cluster
  applies the write as an upsert keyed by document id, so a repeat write overwrites the document
  rather than adding a second copy. Failure mode: a 5xx or a missed deadline counts as a failure
  against the circuit breaker in `src/breaker.js`; 20 consecutive failures open it for 30000 ms.
  Degradation path: while the breaker is open the worker makes zero calls into the cluster,
  requeues each message with `nack`, and logs `index.shed`, so a saturated cluster stops
  receiving retry load instead of absorbing more of it. A message that exhausts its 4 attempts
  is requeued the same way, and the broker's own dead-letter policy moves it to
  `documents.ingest.dlq` after its redelivery limit, for manual replay.

## Overload behavior

`documents.ingest` grows whenever the crawler publishes faster than the worker indexes. The
platform team holds a max-length policy of 200000 messages on that queue. Past that depth the
broker rejects the crawler's publishes, and the crawler sheds by dropping re-crawl candidates
and degrading re-crawl freshness from 6 hours to 24 hours, rather than letting the queue grow
until something is killed for running out of memory. Shedding happens at publish time, on the
producing side; the worker never drops a message the broker has already handed it.

## Duplicate delivery

Delivery is at-least-once: the broker redelivers any message the worker has not acked, which
happens on every restart, every requeue, and every ack that misses its deadline. The worker
keeps the last 50000 acked message ids in memory in `src/processed-ids.js`, evicting oldest
first, and acks a repeat delivery immediately without calling the search cluster again. The
upsert keyed by document id is the second layer, so a duplicate that arrives after its id has
been evicted still cannot produce a second document.

## Logging

The worker writes one JSON object per line to stdout through `src/logger.js`. Every line carries
`timestamp`, `service`, `level`, `event`, and `trace_id`. The trace id arrives on the message and
is passed into the search cluster call and into every ack and nack, so one document is
followable across both integrations and across the async boundary between them. The log
pipeline that collects stdout belongs to the platform team and is not in this repository;
retention is 14 days for `message.indexed`, `message.duplicate`, `batch.received`, and
`worker.heartbeat`, and 90 days for `index.attempt_failed`, `index.shed`, `breaker.opened`,
`message.redelivering`, and `worker.exiting`. Absence of `worker.heartbeat` for 5 minutes is the
deadman signal for this worker; that alert rule lives with the platform team's alerting, not
here.
