---
marp: true
theme: default
paginate: true
---

# Метрики → VictoriaMetrics

Отправка и хранение метрик

---

## Что такое VictoriaMetrics?

VictoriaMetrics — это высокопроизводительная база данных временных рядов (TSDB), разработанная как эффективная замена Prometheus для долгосрочного хранения метрик. Она отличается низким потреблением ресурсов, высокой скоростью записи и компактным хранением данных.

- **Полная совместимость с Prometheus** — поддерживает PromQL для запросов, remote write для приёма данных, а также расширенный язык MetricsQL с дополнительными функциями (rollup, default, limit и др.)
- **Нативная поддержка OTLP** — принимает метрики напрямую по протоколу OpenTelemetry без промежуточных компонентов (vmagent, Prometheus). Достаточно указать URL с суффиксом `/opentelemetry`
- **Single-node архитектура** — для большинства инсталляций достаточно одного бинарника. Нет зависимостей от внешних хранилищ или координаторов. Для масштабирования доступна кластерная версия
- **Встроенный UI (VMUI)** — веб-интерфейс для выполнения запросов и визуализации метрик без необходимости устанавливать Grafana на этапе отладки
- **Эффективное сжатие** — хранит данные в 5-10 раз компактнее, чем Prometheus, что особенно важно при длительном хранении метрик

В нашем стенде: `http://localhost:8428` | Документация: [docs.victoriametrics.com](https://docs.victoriametrics.com)

---

## Как коллектор отправляет метрики?

Для отправки метрик из коллектора в VictoriaMetrics используется otlphttp exporter — стандартный компонент OpenTelemetry, который передаёт данные по протоколу OTLP через HTTP. Это прямое соединение без промежуточных агентов.

```yaml
exporters:
  otlphttp:
    endpoint: http://victoriametrics:8428/opentelemetry
    compression: gzip
    encoding: proto
```

- `endpoint` — URL VictoriaMetrics с суффиксом `/opentelemetry`. Этот эндпоинт принимает метрики в формате OTLP и автоматически преобразует их во внутренний формат VictoriaMetrics
- `compression: gzip` — сжатие данных перед отправкой. Снижает объём сетевого трафика в 5-10 раз, что критично при большом количестве метрик
- `encoding: proto` — бинарный формат protobuf. Эффективнее JSON по размеру и скорости сериализации

---

## Transform processor

При передаче метрик через OTLP в VictoriaMetrics с включённым флагом `usePrometheusNaming` происходит автоматическая трансформация имён: к имени метрики добавляется суффикс на основе единицы измерения (unit). Если unit пустой, VictoriaMetrics интерпретирует его как unix timestamp и добавляет суффикс `_unixtime`, что искажает имена метрик.

Например, `postgresql_cache_hit_ratio` превращается в `postgresql_cache_hit_ratio_unixtime`, а `postgresql_databases_commits` — в `postgresql_databases_commits_unixtime_total`. Это затрудняет поиск метрик и делает имена неочевидными.

Решение — transform processor, который устанавливает unit `"1"` (безразмерная величина) для всех метрик с пустым unit:

```yaml
processors:
  transform:
    metric_statements:
      - context: metric
        statements:
          - set(unit, "1") where unit == ""
```

После этого имена метрик становятся корректными: `postgresql_cache_hit_ratio`, `postgresql_databases_commits_total`.

---

## Обновлённый пайплайн — config-step2

В config-step2 мы добавляем три новых компонента к пайплайну метрик. Transform processor исправляет unit перед отправкой, batch processor группирует данные в пакеты для эффективной передачи, а otlphttp exporter отправляет метрики в VictoriaMetrics. Prometheus exporter остаётся для локальной проверки и сравнения имён.

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

Порядок процессоров важен: сначала ограничиваем память, затем трансформируем unit, затем группируем в батчи. Данные отправляются параллельно в оба exporter-а.

---

## Имена метрик: Prometheus vs OTLP

При передаче через OTLP VictoriaMetrics с флагом `usePrometheusNaming` автоматически добавляет суффиксы единиц измерения к именам метрик. Это соответствует конвенциям Prometheus: counters получают `_total`, а unit добавляется к имени. Благодаря transform processor метрики без unit получают корректные имена.

| Prometheus exporter | VictoriaMetrics (OTLP) | Почему |
|--------------------|----------------------|--------|
| `postgresql_health_uptime` | `postgresql_health_uptime_milliseconds` | unit = ms |
| `postgresql_wal_bytes` | `postgresql_wal_bytes_total` | counter + unit = bytes |
| `system_cpu_time` | `system_cpu_time_seconds_total` | counter + unit = s |
| `system_memory_usage` | `system_memory_usage_bytes` | gauge + unit = bytes |

---
