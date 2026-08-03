# Checkout session API - architecture record

## Shape

One Node service, `checkout-session-api`, serves the signed-in checkout surface:
`POST /login`, `GET /me`, and the two probe routes `GET /healthz` and
`GET /readyz`. deploy/deployment.yaml declares the Deployment that runs it and
the Service that fronts it. The Deployment runs 6 replicas and the Service sets
`sessionAffinity: None`, so two requests from the same client can land on two
different replicas.

`POST /login` answers with a session id. The client presents that id in the
`x-session-id` header on `GET /me`, and the id is good for 30 minutes.

This service owns no durable store: no database, no object store, no migration,
and no infrastructure definition for one exists in this repository. It runs no
scheduled or background job of any kind. It exposes no upload route and writes
no file to local disk.

## Why the service runs on Kubernetes

The checkout platform contract requires every service that handles signed-in
checkout traffic to run inside the shared cluster the platform team operates,
which is a Kubernetes cluster. A service placed outside that cluster falls
outside the quarterly platform attestation the contract is written against. That
constraint decided the runtime, and the manifest in deploy/ is the whole of it:
no mesh, no gateway, and no second deployable.

## Targets at 12 months

- Scale ceiling: 40000 registered accounts, 2500 concurrent signed-in sessions
  at peak, 300 requests per second sustained and 600 requests per second peak.
- The login path is performant at p95 700 ms and p99 1100 ms measured at the Service, with the single identity directory lookup capped at 400 ms.
- `GET /me` answers at p95 under 120 ms and p99 under 300 ms, measured at the
  Service.
- Availability: 99.94 percent of requests succeed per calendar month, which
  allows 26 minutes of failed or refused service in a 30 day month.
- Rate limiting: 100 requests per minute per account, counted across the whole
  service and not per replica.

## Where the availability number comes from

`GET /readyz` pings the identity directory, so a directory outage takes replicas
out of the Service rather than leaving them to accept logins they cannot finish.
Both routes therefore carry the directory in their availability chain. The
platform team publishes 99.99 percent per month for the directory and this
service holds 99.95 percent on its own account: 99.95 percent times 99.99
percent is 99.94 percent, which is the number recorded above.

## External integrations and their failure modes

The identity directory is the only process this service calls.
src/identity-directory.js holds the client, config/service.json holds its URL,
and every call leaves through the timeout wrapper in that module. `GET /me`
makes no directory call; the login and readiness paths are the only outbound
call sites.

- Failure mode: the directory is slow, unreachable, or answers an error.
- On `POST /login` the lookup is capped at 400 ms. Past that cap the route
  answers 503, creates no session, and queues nothing for later.
- On `GET /readyz` the ping is capped at 400 ms. Past that cap the route answers
  503, and the readiness probe removes the replica after 3 consecutive failures
  5 seconds apart.
- Degradation path: no new logins are issued while the directory is down.
  `POST /login` answers 503 and retries nothing of its own, so the caller
  decides when to send the login again.

## Logs

Every log line is one JSON object with `timestamp`, `service`, `level`, `event`,
and `trace_id`. The trace id is the `x-request-id` header when the caller
supplies one and a generated id otherwise; it is handed to the identity
directory client and echoed on the response as `x-trace-id`. Retention is 30
days for request logs and 90 days for error logs.

## Rollout and configuration

Releases use the RollingUpdate strategy in deploy/deployment.yaml, one replica
unavailable and one surge replica at a time, at 12 releases per month. No other
rollout shape is used for this service.

Runtime values live in config/service.json: the listen port, the identity
directory URL, and the two call timeouts. Nothing under src/ reads the
environment or hardcodes a host.
