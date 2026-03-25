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
- Совместима с Prometheus (PromQL, remote write)
- Поддерживает приём данных через **OTLP** (OpenTelemetry Protocol)
- Single-node — одного бинарника достаточно

В нашем стенде: `http://localhost:8428`

---

## Как коллектор отправляет метрики?

Добавляем **otlphttp exporter** в конфиг:

```yaml
exporters:
  otlphttp:
    endpoint: http://victoriametrics:8428/opentelemetry
    compression: gzip
    encoding: proto
```

- `endpoint` — URL VictoriaMetrics с суффиксом `/opentelemetry`
- `compression: gzip` — сжатие для экономии трафика
- `encoding: proto` — бинарный формат (эффективнее JSON)

---

## Transform processor

Метрики с пустой единицей измерения получают суффикс `_unixtime` в VictoriaMetrics. Исправляем через transform processor:

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
        - transform           # исправление unit для VM
        - batch/metrics
      exporters:
        - prometheus        # для проверки (остаётся)
        - otlphttp          # → VictoriaMetrics (новый)
```

Добавлены `transform`, `batch/metrics` и `otlphttp`.

---

## Имена метрик: Prometheus vs OTLP

При передаче через OTLP VictoriaMetrics добавляет суффиксы единиц измерения:

| Prometheus exporter | VictoriaMetrics (OTLP) |
|--------------------|----------------------|
| `postgresql_health_uptime` | `postgresql_health_uptime_milliseconds` |
| `postgresql_wal_bytes` | `postgresql_wal_bytes_total` |
| `system_cpu_time` | `system_cpu_time_seconds_total` |
| `system_memory_usage` | `system_memory_usage_bytes` |

---
