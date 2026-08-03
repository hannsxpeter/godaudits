# Orders API architecture

One deployable: a Node HTTP process, orders-api, in src/server.js. It accepts
and serves customer orders for a single retail brand. It owns one durable
store, the managed Postgres instance orders-postgres declared in
infra/database.tf.

No queue, no cache, no second deployable, no Kubernetes manifest, no
autoscaler, no CDN. External integrations: none. The only cross-process
dependency this process has is orders-postgres.

## Surface

- POST /orders writes one order row to orders-postgres, scoped to the tenant on the request.
- GET /orders/:orderId reads one order row, scoped to the same tenant.
- GET /recovery returns the recovery objectives recorded below.
- GET /healthz issues a real round trip to orders-postgres and answers 503 when that round trip fails or runs out of time.

## Recorded targets, 12 month horizon

- Scale ceiling: scalable to 40000 orders per day and 90 order reads per second at peak; past 90 reads per second the recorded next step is a larger instance class for orders-postgres.
- Storage ceiling: 220 GB in orders-postgres at that order volume.
- Read latency: p95 under 250 ms and p99 under 600 ms on GET /orders/:orderId. One Postgres round trip carries the path, measured p95 38 ms; the 400 ms deadline in src/db.js is the failure ceiling, not the expected cost.
- RPO for orders-postgres: 5 minutes of accepted data loss.
- RTO for orders-postgres: 60 minutes from incident declaration to serving reads again, met by restoring the most recent recovery point into a fresh instance. There is no standby instance, no second region, and no promoted replica anywhere in infra/database.tf, and the 60 minutes prices that restore rather than a failover.

## orders-postgres failure mode and degradation path

Named failure mode: orders-postgres refuses a connection or stalls a query.

Every call into the store runs under the 400 ms deadline in src/db.js. When the
deadline trips, POST /orders answers 503 with a retry hint and writes nothing,
GET /orders/:orderId answers 503, and GET /healthz answers 503 so the operator
sees the store rather than the process. The process buffers no pending writes,
so the caller that received the 503 owns the retry.

## Durability

Recovery points for orders-postgres are whatever infra/database.tf declares. An
AWS Backup plan is bound to the instance by aws_backup_selection.orders through
the aws_iam_role.backup role, and the rule in that plan sets both the schedule
and the 30 day retention in aws_backup_vault.orders. The instance sets
backup_retention_period = 0, so the managed automated-backup window is off and
the plan's recovery points are the mechanism.

Restore drill, 2026-06-18: the on-call restored the 2026-06-17 recovery point
into a scratch instance, replayed the ten most recent order ids against it, and
recorded 47 minutes from declaration to first served read. That drill is logged
here and nowhere else; this repository has no runbook directory.

## Records this service publishes

GET /recovery serves the RPO, the RTO, the name of the backup plan that protects
the store, and the date of the last restore drill. The numbers it serves live in
src/recovery/objectives.js.

## Logs

The service writes one JSON object per line through src/logger.js, carrying
timestamp, service, level, event, and trace_id. trace_id comes from the
X-Request-Id header when the caller sends one and is generated per request
otherwise, so one identifier covers a request end to end. Request logs are
retained 30 days and error logs are retained 90 days. That retention is
separate from the 30-day AWS Backup vault retention, which covers recovery
points rather than logs.
