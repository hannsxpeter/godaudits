'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

// The reading snapshot ships read-only inside the image. The process
// reads it and never writes it back, so there is nothing durable here.
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'readings-snapshot.json');

// Explicit ceiling for the only module-level collection in the service.
// The recorded scale ceiling is 4200 devices; entries past MAX_DEVICES
// are evicted at load time and counted, so the map cannot grow with the
// file it is loaded from.
const MAX_DEVICES = 5000;

// Every read of the snapshot file is bounded, including the one the
// readiness handler performs on the request path.
const SNAPSHOT_READ_TIMEOUT_MS = 750;

const latest = new Map();

function withTimeout(work, ms, label) {
  let timer = null;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' exceeded ' + ms + ' ms')), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

async function readSnapshotFile() {
  const raw = await withTimeout(
    fs.readFile(SNAPSHOT_PATH, 'utf8'),
    SNAPSHOT_READ_TIMEOUT_MS,
    'snapshot read'
  );
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.readings)) {
    throw new Error('snapshot carries no readings array');
  }
  return parsed;
}

async function load() {
  const parsed = await readSnapshotFile();
  latest.clear();

  let evicted = 0;
  for (const entry of parsed.readings) {
    if (!entry || typeof entry.deviceId !== 'string') {
      continue;
    }
    if (latest.size >= MAX_DEVICES) {
      evicted += 1;
      continue;
    }
    latest.set(entry.deviceId, { kwh: entry.kwh, takenAt: entry.takenAt });
  }

  return { loaded: latest.size, evicted: evicted, generation: parsed.generation };
}

// The read surface is one site-wide roll-up. No caller-supplied selector
// reaches the map, so every caller receives the same aggregate.
function siteTotals() {
  let kwh = 0;
  let newest = null;
  for (const reading of latest.values()) {
    kwh += reading.kwh;
    if (!newest || reading.takenAt > newest) {
      newest = reading.takenAt;
    }
  }
  return { devices: latest.size, kwh: Number(kwh.toFixed(3)), takenAt: newest };
}

// Readiness re-reads the file the request path was populated from, so a
// pod whose snapshot has gone away or stopped parsing reports itself
// unready instead of answering reads it can no longer serve.
async function probe() {
  const parsed = await readSnapshotFile();
  const onDisk = parsed.readings.length;
  return {
    ok: onDisk > 0 && latest.size > 0,
    onDisk: onDisk,
    inMemory: latest.size,
    generation: parsed.generation
  };
}

module.exports = { load, siteTotals, probe, MAX_DEVICES, SNAPSHOT_PATH };
