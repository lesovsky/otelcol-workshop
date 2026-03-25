---
marp: true
theme: default
paginate: true
---

# Метрики → VictoriaMetrics

Отправка и хранение метрик

---

## Что такое VictoriaMetrics?

- Высокопроизводительная TSDB (time series database)
- Совместима с Prometheus (PromQL, remote write, MetricsQL)
- Нативная поддержка OTLP
- Single-node — одного бинарника достаточно
- Встроенный UI (VMUI)

В нашем стенде: `http://localhost:8428`

---

## Как коллектор отправляет метрики?

```yaml
exporters:
  otlphttp:
    endpoint: http://victoriametrics:8428/opentelemetry
    compression: gzip
    encoding: proto
```

Прямое соединение по OTLP без промежуточных агентов.

---

## Transform processor

Метрики с пустым unit получают суффикс `_unixtime`. Исправляем:

```yaml
processors:
  transform:
    metric_statements:
      - context: metric
        statements:
          - set(unit, "1") where unit == ""
```

---

## Обновлённый пайплайн — config-step2

```yaml
service:
  pipelines:
    metrics:
      receivers:
        - postgrespro
        - hostmetrics
      processors:
        - memory_limiter/metrics
        - transform
        - batch/metrics
      exporters:
        - prometheus
        - otlphttp
```

---

## Имена метрик: Prometheus vs OTLP

| Prometheus exporter | VictoriaMetrics (OTLP) |
|--------------------|----------------------|
| `postgresql_health_uptime` | `postgresql_health_uptime_milliseconds` |
| `postgresql_wal_bytes` | `postgresql_wal_bytes_total` |
| `system_cpu_time` | `system_cpu_time_seconds_total` |
| `system_memory_usage` | `system_memory_usage_bytes` |

---
