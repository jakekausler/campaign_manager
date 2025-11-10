# Development Scripts

This directory contains utility scripts for local development.

## Dev Server Logging

### Overview

The logging scripts redirect all output from `pnpm dev` commands to log files in `/tmp`, making it easier to debug issues and keep a persistent record of dev server output.

### Available Commands

#### Run All Packages with Logging

```bash
pnpm run dev:logged
```

This starts all packages (api, frontend, rules-engine, scheduler) in parallel with logging enabled. Each package logs to its own file:

- `/tmp/campaign-api-dev.log`
- `/tmp/campaign-frontend-dev.log`
- `/tmp/campaign-rules-engine-dev.log`
- `/tmp/campaign-scheduler-dev.log`

#### Run Individual Packages with Logging

```bash
pnpm run dev:api          # API server only
pnpm run dev:frontend     # Frontend only
pnpm run dev:rules-engine # Rules engine worker only
pnpm run dev:scheduler    # Scheduler worker only
```

### Log Files Location

All log files are written to `/tmp` with the naming convention:

```
/tmp/campaign-<package-name>-dev.log
```

### Viewing Logs

You can view logs in real-time using `tail`:

```bash
# Follow API logs
tail -f /tmp/campaign-api-dev.log

# Follow all logs simultaneously
tail -f /tmp/campaign-*-dev.log

# Search logs for errors
grep -i error /tmp/campaign-api-dev.log
```

### How It Works

The logging scripts use `tee` to pipe output to both:

1. The terminal (stdout/stderr) - so you see output as normal
2. A log file in `/tmp` - for persistent storage

This means you get the same interactive experience as running `pnpm dev` directly, but with the added benefit of persistent logs.

### Script Details

- `dev-with-logging.sh` - Wrapper script for running a single package with logging
- `dev-all-with-logging.sh` - Orchestration script that runs all packages in parallel with logging

Both scripts:

- Create/truncate log files at startup
- Handle graceful shutdown (Ctrl+C)
- Display log file locations on startup
- Preserve all output (stdout + stderr)
