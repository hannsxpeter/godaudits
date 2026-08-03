# Catalog service architecture

One deployable: a Node HTTP process that answers "what does this SKU cost and
how many are on hand" for the storefront, and applies the price and inventory
changes merchandising sends it. Postgres (catalog-postgres) is the record of
truth for both entities and Redis (catalog-cache) sits in front of the read
path. The process serves four routes: GET /products/:sku, GET /inventory/:sku,
POST /changes, and GET /healthz.

## Numeric targets, 12 month horizon

- Scale ceiling: the catalog is scalable to 900000 SKUs and 1200 catalog reads per second at peak.
- Read latency: p95 under 120 ms for GET /products/:sku, measured at the process edge.
- Price freshness: a price change accepted on POST /changes is visible on the storefront within 60 seconds, p99.
- Inventory freshness: an on-hand change accepted on POST /changes is visible on the storefront within 30 seconds, p99.
- Write volume ceiling: 40 changes per second at peak, 8000 changes per day.
- Availability: 99.5 percent monthly for the read routes.

## Where the availability number comes from

The process runs as one instance. There is no standby, no second replica, and
no failover target. 99.5 percent allows 216 refused or failed minutes per 30
days, and merchandising accepted that number in place of a second instance
because the storefront falls back to a category page rather than a checkout
error while catalog reads are down. The accepted downtime is the record; no
number above it is claimed anywhere.

## Caching layer

Redis holds two keys, both addressed by SKU alone. The catalog is public and
identical for every shopper: no key carries a user, session, or tenant
component because no value behind these keys differs by user, session, or
tenant, and no per-user value is read, written, or cached anywhere in this
service.

- `product:<sku>` holds name, description, and price in cents, with a TTL of 604800 seconds.
- `inventory:<sku>` holds the on-hand count, with a TTL of 15 seconds.

Every response, on every route, carries `Cache-Control: no-store`. There is no
CDN, no reverse proxy, and no browser cache in front of this process, so Redis
is the only cache between the storefront and Postgres.

## Write paths

Merchandising signs each change and posts it to POST /changes. The handler in
src/server.js verifies the signature, rejects a malformed change, and dispatches
into src/catalog.js.

- `applyInventoryChange` updates the inventory row and then deletes `inventory:<sku>`, so the next read reloads the row from Postgres.
- `applyPriceChange` updates the product row.

A change carries a change id and that id is recorded only after the apply
returns, so a change that fails part way through is answered 503 and applied on
redelivery rather than swallowed. The recorded ids are bounded at 10000 with the
oldest dropped, and both applies are single-row updates matched on the primary
key, so a replay is the same write twice rather than a second effect.

## How the read path meets its numbers

A cache hit is one Redis GET, budgeted at 15 ms p95 and cut off at 20 ms. A miss
adds one Postgres point read on the primary key, budgeted at 25 ms p95 and cut
off at 60 ms, and one Redis SET, budgeted at 15 ms p95 and cut off at 20 ms. The
miss path costs at most 100 ms even when all three calls run to their cutoffs,
which is inside the 120 ms p95 target.

Postgres serves whatever the cache does not. Reads split about evenly across the
two keys at the 1200 reads per second ceiling. Spread over 900000 SKUs, one SKU
is read about once every 1500 seconds, far longer than the 15 second inventory
TTL, so close to every inventory read is a miss: about 600 Postgres reads per
second. That same 1500 second spacing is far shorter than the 604800 second
product TTL, so product reads miss only on a cold or evicted key and add under
10 Postgres reads per second in steady state. catalog-postgres is provisioned
for 1200 reads per second, so losing Redis entirely moves the read path from
about 610 to 1200 Postgres reads per second and costs latency, not availability.

## External integrations and their failure modes

- Redis at REDIS_URL. Every command is cut off at 20 ms. A timeout or error on
  the read path is logged and treated as a miss, so the request continues
  against Postgres. A timeout or error on the delete in `applyInventoryChange`
  is not absorbed: the change is answered 503 and merchandising redelivers it.
- Postgres at DATABASE_URL. Every statement is cut off at 60 ms. A timeout or
  error on a read is logged and answered 503 rather than an empty product, and a
  timeout or error while applying a change leaves the change id unrecorded so
  the redelivery applies it.
- Merchandising reaches this service inbound on POST /changes and this service
  makes no outbound call to it. An unsigned or wrongly signed body is answered
  401 and nothing is written.

## Backpressure and admission control

Reads collapse onto one loader per key: a second request for a key already being
loaded waits on the first rather than issuing its own Postgres read, so an
expired key sends one read and not one per waiting request. The process admits
at most 512 keys in flight and answers 503 above that, which is the recorded
shed behavior at overload. A change body over 65536 bytes is refused while it
streams. Nothing queues inside this process: there is no buffer, no worker pool,
and no in-process work list.

## Durability of catalog-postgres

- RPO: 5 minutes of accepted loss for catalog rows.
- Backup: continuous write-ahead log archiving on a 60 second archive interval, plus one base backup every 24 hours, retained 30 days. Worst case loss is the 60 second archive interval, inside the 5 minute RPO.
- RTO: 45 minutes from incident declaration to serving reads again.
- Last restore drill: 2026-06-18. A base backup plus log replay was restored to a spare instance and served reads 31 minutes after the drill was declared, inside the 45 minute RTO.

## Absent surfaces

- External integrations beyond Redis, Postgres, and the inbound merchandising
  webhook: none.
- No queue broker, no async consumer, no scheduled job, no worker, and no second
  deployable.
- No Kubernetes, no service mesh, no API gateway, no autoscaler, and no CDN.
- No tenant dimension: one retail brand, one catalog, and the same public
  answer for every caller of a read route.
- No authenticated read surface. POST /changes is the only authenticated route
  and the only route that writes.

## Configuration and logs

Four environment variables are read. REDIS_URL, DATABASE_URL, and
MERCHANDISING_WEBHOOK_SECRET are required and the process refuses to listen
without all three. PORT is optional and defaults to 8080. `npm start` runs
`node src/server.js`, which is the only entry point.

Logs are one JSON object per line on stdout, written only by src/logger.js and
carrying timestamp, service, level, event, and trace_id. trace_id is taken from
the X-Request-Id header when the caller sends one and generated per request
otherwise, and every log line a request emits carries that trace_id, including
the lines written around the cache call, the Postgres call, and the change
apply, so one identifier covers a request end to end. Request logs are retained
30 days and error logs are retained 90 days.

GET /healthz issues a Redis PING and a Postgres liveness statement on every
call, each under its own cutoff, and answers 503 when either fails.
