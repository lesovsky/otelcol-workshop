---
marp: true
theme: default
paginate: true
---

# Логи → VictoriaLogs

Сбор и хранение логов PostgreSQL

---

## Подготовка PostgreSQL для логирования

```
log_destination = 'jsonlog'
logging_collector = on
log_checkpoints = on
log_lock_waits = on
log_temp_files = 0
```

JSON-формат — структурированный, удобен для парсинга.

---

## Пример JSON-лога PostgreSQL

```json
{
  "timestamp": "2026-03-03 05:33:05.031 GMT",
  "user": "postgres",
  "dbname": "postgres",
  "pid": 59,
  "error_severity": "LOG",
  "message": "connection authorized: user=postgres database=postgres",
  "backend_type": "client backend",
  "query_id": 0
}
```

---

## filelog receiver — читаем логи

```yaml
receivers:
  filelog:
    include:
      - /var/log/postgresql/*.json
    start_at: end
    operators:
      - type: json_parser
        parse_ints: true
        timestamp:
          parse_from: attributes.timestamp
          layout_type: strptime
          layout: '%Y-%m-%d %H:%M:%S.%L %Z'
        severity:
          parse_from: attributes.error_severity
          mapping:
            debug: [ DEBUG ]
            info:  [ INFO, NOTICE, LOG ]
            warn:  [ WARNING ]
            error: [ ERROR ]
            fatal: [ FATAL, PANIC ]
```

---

## filelog receiver — ключевые моменты

- `include` — glob-паттерн для файлов логов
- `start_at: end` — только новые записи
- `json_parser` — парсит JSON, извлекает атрибуты
- `timestamp` — парсит временную метку
- `severity` — маппинг severity PostgreSQL → OpenTelemetry

---

## Что такое VictoriaLogs?

- Хранилище логов от VictoriaMetrics
- Приём данных через OTLP
- Язык запросов LogsQL
- Встроенный UI с live-режимом

В нашем стенде: `http://localhost:9428`

---

## otlphttp/victorialogs exporter

```yaml
exporters:
  otlphttp/victorialogs:
    endpoint: http://victorialogs:9428/insert/opentelemetry
    compression: gzip
    encoding: proto
```

Именованный экземпляр — тот же тип `otlphttp`, другой endpoint.

---

## resource processor — идентификация источника

```yaml
processors:
  resource:
    attributes:
      - key: service.name
        action: upsert
        value: postgresql
      - key: service.instance.id
        action: upsert
        value: postgres:5432
```

Атрибуты формируют **_stream** в VictoriaLogs.

---

## Пайплайн логов — config-step3

```yaml
service:
  pipelines:
    metrics:
      receivers:  [postgrespro, hostmetrics]
      processors: [memory_limiter/metrics, transform, batch/metrics]
      exporters:  [prometheus, otlphttp]
    logs:
      receivers:  [filelog]
      processors: [resource, attributes/convert, batch/logs]
      exporters:  [otlphttp/victorialogs]
```

Два независимых пайплайна: метрики и логи.

---
