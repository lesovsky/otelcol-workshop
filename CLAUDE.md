# CLAUDE.md — pgconf-o11y-workshop

## Project Overview

Workshop materials for "PostgreSQL Monitoring with OpenTelemetry".
Target audience: DBAs, sysadmins, DevOps, SRE.
Format: ~4 hours, theory (slides) + hands-on practice on pre-built environment.

## Architecture

PostgreSQL 18 → PGPRO OTEL Collector → VictoriaMetrics (metrics) + VictoriaLogs (logs) → Grafana.

Key components:
- **postgrespro receiver** — collects PostgreSQL metrics (activity, wal, bgwriter, locks, cache, etc.)
- **hostmetrics receiver** — collects OS metrics (cpu, mem, disk, net, load)
- **filelog receiver** — collects PostgreSQL JSON logs
- **otlphttp exporter** — sends metrics to VictoriaMetrics and logs to VictoriaLogs
- **prometheus exporter** — exposes metrics on :8889 for verification
- **pgbench** — generates continuous workload for "live" metrics

## Project Structure

```
pgconf-o11y-workshop/
├── CLAUDE.md                           # this file
├── PLAN.md                             # workshop plan with decomposed tasks
├── docker-compose.yml
├── dockerfiles/
│   └── otel-collector/
│       └── Dockerfile                  # Debian + pgpro-otel-collector deb package
├── configs/
│   ├── otel-collector/
│   │   ├── config-step1.yaml           # postgrespro + hostmetrics → prometheus exporter
│   │   ├── config-step2.yaml           # + otlphttp → VictoriaMetrics
│   │   └── config-step3.yaml           # + filelog → VictoriaLogs (final)
│   ├── postgres/
│   │   └── postgresql.conf             # jsonlog, log_checkpoints, etc.
│   └── grafana/
│       └── provisioning/
│           ├── datasources/
│           │   └── datasources.yaml    # VictoriaMetrics + VictoriaLogs
│           └── dashboards/
│               ├── dashboards.yaml
│               └── postgresql.json
├── slides/                             # Marp markdown → PDF
│   ├── 01-intro-otel.md
│   ├── 02-pgpro-otel-collector.md
│   ├── 03-victoriametrics.md
│   ├── 04-victorialogs.md
│   └── 05-visualization.md
├── guide/
│   └── workshop-guide.md              # step-by-step instructions for participants
└── pgpro-otel-collector-examples/     # reference configs from deb package
```

## Key Technical Decisions

- PostgreSQL 18 with `log_destination=jsonlog`, `log_checkpoints=on`, `log_lock_waits=on`, `log_temp_files=0`
- PGPRO OTEL Collector installed from deb package (no Docker image available), custom Dockerfile based on Debian
- Metrics sent via otlphttp exporter directly to VictoriaMetrics (no vmagent intermediary)
- Logs sent via otlphttp exporter to VictoriaLogs (not Elasticsearch)
- Incremental config approach: step1 → step2 → step3, participants build config progressively
- OTel Collector config mounted as Docker volume for easy restart during workshop
- pgbench runs in a separate container for continuous workload

## PGPRO OTEL Collector

- Deb packages: https://repo.postgrespro.ru/otelcol/otelcol/debian/pool/main/o/otelcol/
- Binary: `/usr/bin/pgpro-otel-collector`
- Config format: YAML (same as OpenTelemetry Collector)
- Supports multiple config files: `--config file1.yml --config file2.yml`

## Conventions

- All communication and plans in Russian
- Code, configs, technical docs in English
- Slides in Markdown (Marp format), output to PDF
- Workshop guide in Markdown
