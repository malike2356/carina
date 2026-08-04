#!/usr/bin/env node
/**
 * Labyrinth Protect Linux endpoint agent (MVP).
 * Registers with Scout, heartbeats, emits telemetry, polls Soft Wall commands.
 * Network isolate is a stub that records intent locally (no offensive features).
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir, hostname as hostNameFn } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const STATE_DIR = process.env.PROTECT_STATE_DIR || join(homedir(), '.protect-agent');
const STATE_FILE = join(STATE_DIR, 'state.json');
const ISOLATE_FLAG = join(STATE_DIR, 'network-isolate.flag');

function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  process.stdout.write(line);
  mkdirSync(STATE_DIR, { recursive: true });
  appendFileSync(join(STATE_DIR, 'agent.log'), line);
}

async function scoutFetch(base, path, key, init) {
  return fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Scout-Key': key,
      ...(init?.headers ?? {}),
    },
  });
}

async function register(base, accountKey) {
  const res = await scoutFetch(base, '/api/protect/sensors/register', accountKey, {
    method: 'POST',
    body: JSON.stringify({
      label: `linux:${hostNameFn()}`,
      hostname: hostNameFn(),
      platform: 'linux',
    }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const state = {
    accountApiKey: accountKey,
    scoutBaseUrl: base,
    sensorId: data.sensorId,
    sensorKey: data.key,
  };
  saveState(state);
  log(`registered sensor ${data.sensorId}`);
  return state;
}

async function heartbeat(state) {
  const res = await scoutFetch(
    state.scoutBaseUrl,
    `/api/protect/sensors/${state.sensorId}/heartbeat`,
    state.accountApiKey,
    { method: 'POST', body: '{}' },
  );
  if (!res.ok) throw new Error(`heartbeat failed: ${res.status}`);
}

async function emitTelemetry(state) {
  const events = [
    {
      schema_version: 'protect.telemetry.v1',
      event_type: 'asset.heartbeat',
      occurred_at: new Date().toISOString(),
      payload: { status: 'ok', hostname: hostNameFn() },
    },
    {
      schema_version: 'protect.telemetry.v1',
      event_type: 'agent.health',
      occurred_at: new Date().toISOString(),
      payload: { status: existsSync(ISOLATE_FLAG) ? 'isolated' : 'ok' },
    },
    {
      schema_version: 'protect.telemetry.v1',
      event_type: 'process.exec',
      occurred_at: new Date().toISOString(),
      payload: { pid: process.pid, cmd: 'protect-agent' },
    },
    {
      schema_version: 'protect.telemetry.v1',
      event_type: 'net.conn',
      occurred_at: new Date().toISOString(),
      payload: { remote_host: '127.0.0.1', remote_port: 4444, direction: 'out' },
    },
  ];

  const res = await scoutFetch(state.scoutBaseUrl, '/api/protect/telemetry/ingest', state.accountApiKey, {
    method: 'POST',
    body: JSON.stringify({ sensor_id: state.sensorId, events }),
  });
  if (!res.ok) throw new Error(`telemetry failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  log(`telemetry stored=${body.stored}`);
}

async function pollCommands(state) {
  const res = await scoutFetch(
    state.scoutBaseUrl,
    `/api/protect/commands/pending?sensorId=${state.sensorId}`,
    state.accountApiKey,
  );
  if (!res.ok) throw new Error(`commands failed: ${res.status}`);
  const body = await res.json();
  for (const cmd of body.commands ?? []) {
    if (cmd.commandType === 'protect.isolate_network') {
      writeFileSync(ISOLATE_FLAG, JSON.stringify({ at: new Date().toISOString(), cmd }, null, 2));
      log(`applied isolate stub for ${cmd.payload?.targetResource ?? 'host'} (flag file only)`);
    }
    await scoutFetch(state.scoutBaseUrl, `/api/protect/commands/${cmd.id}/ack`, state.accountApiKey, {
      method: 'POST',
      body: JSON.stringify({ status: 'applied' }),
    });
  }
}

async function loop(state) {
  for (;) {
    try {
      await heartbeat(state);
      await emitTelemetry(state);
      await pollCommands(state);
    } catch (err) {
      log(`loop error: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(Number(process.env.PROTECT_POLL_MS ?? 15000));
  }
}

async function main() {
  const cmd = process.argv[2] ?? 'run';
  if (cmd === 'register') {
    const base = process.env.SCOUT_URL || process.argv[3];
    const key = process.env.SCOUT_ACCOUNT_KEY || process.argv[4];
    if (!base || !key) {
      console.error('Usage: protect-agent register <SCOUT_URL> <ACCOUNT_API_KEY>');
      process.exit(1);
    }
    await register(base, key);
    return;
  }
  if (cmd === 'uninstall') {
    console.log(`Stop the systemd unit, then: rm -rf ${STATE_DIR}`);
    return;
  }
  const state = loadState();
  if (!state?.sensorId || !state.sensorKey) {
    console.error('Not registered. Run: protect-agent register <SCOUT_URL> <ACCOUNT_API_KEY>');
    process.exit(1);
  }
  log('protect-agent starting');
  await loop(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
