# Meter readings API architecture

One deployable: a Node HTTP process that answers "what is the latest
reading for this device" for the operations console and the field crew
app. It serves two routes, GET /readings and GET /readyz, from a
read-only reading snapshot that ships inside the image. The manifest
that runs it is k8s/deployment.yaml.

## Why the process runs on Kubernetes

Grid operations exposes one compute estate to application teams: the
grid-ops cluster. The utility runs no VM fleet, no serverless account,
and no managed application platform, so a Deployment is the only way any
process this team writes reaches production. Kubernetes here is the
hosting estate the team inherited, not a capacity decision taken for
this service.

## Numeric targets, 12 month horizon

- Scale ceiling: 4,200 registered devices, 60 requests per second at peak, 5.2 million reads per month.
- Read latency: p95 under 120 ms and p99 under 400 ms for GET /readings, measured at the Service.
- Availability: 99.95 percent monthly for GET /readings.

## Where the availability number comes from

The console holds no cached copy of a reading. When GET /readings is
unreachable the operator sees an empty grid and dispatches a crew by
phone instead. The dispatch contract prices that blindness, so the
99.95 percent figure is the number the contract carries, not a
preference the team chose.

## How the read path meets the latency target

A lookup is one map read against the snapshot already resident in the
process, with no network hop and no store behind it.

The read path is performant at 60 requests per second with p95 under 120 ms and p99 under 400 ms.

## Runtime

GET /readings is served by the meter-readings-api Deployment and reached
through the meter-readings-api Service. The API process is the only
component on that request path: no standby process, no second cluster,
and no pod of this Deployment serving alongside the one the manifest
declares.

k8s/deployment.yaml declares the replica count, the rollout strategy, the
TCP liveness check, and the readiness probe on GET /readyz. GET /readyz
re-reads the snapshot file the request path was loaded from and answers
503 when that read fails or returns nothing, so the Service stops routing
to a pod that can no longer serve a reading.

Rollout is RollingUpdate with maxUnavailable 0 and maxSurge 1, so a
replacement pod must pass the readiness probe before the pod it replaces
is removed. No canary analysis is claimed or wired anywhere.

## Absent surfaces

- This service owns no durable store. Nothing is written to disk or to a
  database on any path, so there is no RTO, RPO, backup, or restore drill
  to record.
- External integrations: none. The process makes no outbound network
  call, so there is no third-party failure mode or degradation path to
  record.
- No queue, no async consumer, no scheduled job, no autoscaler, no API
  gateway, and no service mesh.
- No authenticated surface and no tenant dimension. GET /readings serves
  one site-wide roll-up of the whole snapshot to every caller. No request
  parameter selects a record, no caller identity narrows the answer, and
  every caller receives the same bytes, so there is nothing for an
  ownership or tenant predicate to bind.
- Caching: none beyond the process's own copy of the snapshot. It is
  loaded once at startup, bounded at 5,000 devices with the overflow
  dropped and counted, and never written back. It holds whatever
  generation the snapshot file carries for the life of the process, and a
  new generation ships as a new image rather than through an
  invalidation path.

## Configuration and logs

PORT is the only environment variable the process reads, and it defaults
to 8080. Logs are one JSON object per line on stdout carrying timestamp,
service, level, event, and trace_id, written only by src/logger.js.
trace_id is taken from the X-Request-Id header when the caller sends one
and generated per request otherwise. Request logs and process events are
both retained 30 days.
