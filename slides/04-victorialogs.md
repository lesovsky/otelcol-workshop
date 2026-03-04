---
marp: true
theme: default
paginate: true
---

# Логи → VictoriaLogs

Сбор и хранение логов PostgreSQL

---

## Подготовка PostgreSQL для логирования

Ключевые параметры в `postgresql.conf`:

```
log_destination = 'jsonlog'   -- формат JSON
logging_collector = on        -- сборщик логов
log_checkpoints = on          -- контрольные точки
log_lock_waits = on           -- ожидания блокировок
log_temp_files = 0            -- все временные файлы
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

Все поля — атрибуты, которые можно использовать для фильтрации.

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
- `start_at: end` — читаем только новые записи
- `json_parser` — парсит JSON, извлекает атрибуты
- `timestamp` — парсит временную метку из лога
- `severity` — маппинг severity PostgreSQL → OpenTelemetry

---

## Что такое VictoriaLogs?

- Хранилище логов от VictoriaMetrics
- Принимает данные через **OTLP**
- Язык запросов **LogsQL** — простой и мощный
- Единый стек с VictoriaMetrics (один вендор)

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

- Суффикс `/victorialogs` — именованный экземпляр exporter
- Один и тот же тип `otlphttp`, но другой endpoint

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

- `service.name` — имя сервиса (для группировки логов)
- `service.instance.id` — идентификатор инстанса

Эти атрибуты формируют **_stream** в VictoriaLogs.

---

## Пайплайн логов — config-step3

```yaml
service:
  pipelines:
    metrics:                    # пайплайн метрик (без изменений)
      receivers:  [postgrespro, hostmetrics]
      processors: [memory_limiter/metrics, batch/metrics]
      exporters:  [prometheus, otlphttp]

    logs:                       # новый пайплайн логов
      receivers:  [filelog]
      processors: [resource, attributes/convert, batch/logs]
      exporters:  [otlphttp/victorialogs]
```

Два пайплайна: метрики и логи — независимо друг от друга.

---

## Практика: переключаем конфиг

Перейдите к разделу 4 в workshop-guide.

Отредактируйте `docker-compose.yml`:

```yaml
volumes:
  - ./configs/otel-collector/config-step3.yaml:/.../config.yaml:ro
```

```bash
docker compose up -d otel-collector
```

---

## Проверка: VictoriaLogs UI

Откройте: `http://localhost:9428/select/vmui`

Запросы для проверки:

| Запрос | Что покажет |
|--------|------------|
| `*` | Все логи |
| `error_severity:ERROR` | Только ошибки |
| `_msg:"checkpoint"` | Логи checkpoints |
| `_msg:"connection"` | Логи подключений |

---

## Что мы получили

- **filelog receiver** читает JSON-логи PostgreSQL
- **resource processor** добавляет идентификацию (service.name)
- Логи хранятся в **VictoriaLogs**
- Фильтрация через LogsQL
- Финальный конфиг: метрики + логи в одном коллекторе

Следующий шаг — визуализация.

---
