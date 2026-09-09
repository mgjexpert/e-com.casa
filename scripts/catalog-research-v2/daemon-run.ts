// Daemon launcher: spawns the V2 scraper fully detached (reparented to PID 1)
// so it survives shell-session cleanup in restricted environments.
// Usage: DATABASE_URL="postgres://…" bun scripts/catalog-research-v2/daemon-run.ts [cli args...]
import { openSync } from 'node:fs';

const databaseUrl = process.env.DATABASE_URL?.startsWith('postgres')
  ? process.env.DATABASE_URL
  : undefined;
if (!databaseUrl) {
  console.error('daemon-run: DATABASE_URL (postgresql://…) is required');
  process.exit(1);
}

const logfile = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/tmp/scrape-v2-run.log';
const out = openSync(logfile, 'a');
const err = openSync(logfile, 'a');

const child = Bun.spawn({
  cmd: ['bun', 'scripts/catalog-research-v2/cli.ts', ...process.argv.slice(2)],
  env: { ...process.env, DATABASE_URL: databaseUrl },
  cwd: process.cwd(),
  stdin: 'ignore',
  stdout: out,
  stderr: err,
});

// Reparent: do NOT wait; child survives launcher exit
child.unref();
console.log(`daemon launched pid=${child.pid} log=${logfile}`);
process.exit(0);
