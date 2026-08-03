# Help center CMS architecture

One deployable: a Node HTTP process that lets the internal editorial team browse
help center articles and retitle them. It owns one durable store, a Postgres
cluster with one primary and one asynchronous read replica, both declared in
config/database.json. External integrations: none. No queue, no cache, no second
process, no scheduled job.

Tenancy: none. One deployment serves the one help center this company
publishes, so no request carries a tenant and no row is owned by a customer.
The editorial console is the only client; it is a browser app maintained in
another repository and is not part of this one.

## Numeric targets, next 12 months

- Scale ceiling: 90000 articles, 220 reads per second at peak, 400 renames per working day.
- The article library is scalable to 90000 articles and 220 reads per second at peak, which is the ceiling on this line and not a claim past it.
- Request latency: p95 under 400 ms for GET /articles and GET /articles/{articleId}, p95 under 700 ms for PATCH /articles/{articleId}/title.
- Store round trips: 60 ms at p95 each, capped by a 250 ms statement timeout per endpoint. The rename path makes two of them in series, so its worst case is 500 ms inside the 700 ms budget.
- Accepted downtime: up to 4 hours per calendar month, unplanned, recorded here instead of a percentage target. Renames wait; nothing already written is lost.

## Store topology

The primary takes every write. One asynchronous read replica sits behind the
reader endpoint in config/database.json. The provider contract holds
replication lag under 400 ms at p99, and that number is the staleness budget of
the reader endpoint. What each path spends against it is recorded in the table
below.

## Read routing

| Path | Endpoint | Staleness it accepts |
| --- | --- | --- |
| GET /articles, the browse list | reader | up to 400 ms; a title that turns over between two paints of the list costs the reader nothing and is not worth a primary read |
| GET /articles/{articleId}, the editor detail view | primary | none; an editor opens this view to see what the store holds right now |
| The UPDATE inside PATCH /articles/{articleId}/title | primary | not applicable, this is the write |
| GET /healthz, the dependency probe | primary and reader | not applicable, no row is read |

Any path not listed above has no staleness number recorded against it.

## The rename flow

The console sends a new title, the service writes it, and the response carries
the stored article row back so the console can paint its confirmation card
without a second request. A rename overwrites the title in place.

## Store failure modes and degradation

- Primary unreachable, or slower than its 250 ms statement timeout: every handler that touches it answers 503 with `Retry-After: 5`, and the console keeps the editor's draft in the form so a retry costs no retyping.
- Reader unreachable, or slower than its 250 ms statement timeout: every handler that touches it answers 503 with `Retry-After: 5`, and the console keeps painting the page it already holds.
- Either endpoint down: GET /healthz answers 503, so the process is visibly out rather than quietly answering ok.

## Recovery for the article store

- RPO: 5 minutes of accepted loss.
- Backups: a base backup every 24 hours, WAL archived every 60 seconds, so the recoverable point is at most 60 seconds behind the primary, inside the 5 minute RPO.
- RTO: 45 minutes, by restoring the latest base backup onto a fresh primary and replaying archived WAL. Nothing is promoted, because this service runs no standby.
- Restore drill 2026-06-18: the backup was restored onto a scratch instance and served reads 31 minutes after the drill started, inside the 45 minute RTO.

## Data shape and growth

The `articles` table is the only table this service reads or writes: 90000 rows
and roughly 7 GB at the ceiling above, which one node holds without a partition
key. A rename overwrites the title in place, so the row count tracks the article
count rather than the edit count, and this store keeps no event, log, session,
or outbox table that could grow on its own.

## Runtime

- One process, one instance. There is no second instance and no router in front of it, which is why the accepted downtime above is a number rather than a percentage target.
- Endpoints: GET /healthz (unauthenticated), GET /articles, GET /articles/{articleId}, PATCH /articles/{articleId}/title. Every endpoint except /healthz requires the editor bearer token.
- GET /articles pages by keyset: `after` is the last article id of the previous page and `limit` is capped at the 50 in config/database.json.
- Environment: `HELPCENTER_DB_PASSWORD` (store password), `HELPCENTER_EDITOR_TOKEN` (the shared token the console presents), `PORT` (listener, default 8080).
- Logs: one JSON line per event on stdout carrying `timestamp`, `service`, `level`, `event`, and `trace_id`, where `trace_id` is the `X-Request-Id` the caller sends or a UUID this process mints when the caller sends none. Request lines are kept 30 days, error lines 90 days.
- Run it with `npm start`.
