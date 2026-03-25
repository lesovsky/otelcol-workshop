---
marp: true
theme: default
paginate: true
---

# Логи → VictoriaLogs

Сбор и хранение логов PostgreSQL

---

## Подготовка PostgreSQL для логирования

PostgreSQL поддерживает несколько форматов логирования. Для интеграции с OpenTelemetry наиболее удобен JSON — структурированный формат, в котором каждая запись содержит набор именованных полей. Это позволяет парсить логи автоматически без написания регулярных выражений.

Ключевые параметры в `postgresql.conf`:

```
log_destination = 'jsonlog'   -- формат JSON (доступен с PostgreSQL 15)
logging_collector = on        -- встроенный сборщик логов
log_checkpoints = on          -- логирование контрольных точек и их длительности
log_lock_waits = on           -- логирование ожиданий блокировок (порог: deadlock_timeout)
log_temp_files = 0            -- логирование всех временных файлов (0 = любой размер)
```

JSON-формат доступен начиная с PostgreSQL 15. Для более ранних версий потребуется парсинг текстовых логов через регулярные выражения в filelog receiver.

---

## Пример JSON-лога PostgreSQL

Каждая строка в JSON-логе — это самостоятельный JSON-объект с фиксированным набором полей. Все поля становятся атрибутами в OpenTelemetry и могут использоваться для фильтрации и группировки в VictoriaLogs.

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

Ключевые поля: `error_severity` (уровень: LOG, WARNING, ERROR, FATAL), `message` (текст события), `user` и `dbname` (контекст подключения), `pid` (идентификатор процесса), `backend_type` (тип backend-процесса).

---

## filelog receiver — читаем логи

Filelog receiver читает файлы логов, парсит их содержимое и преобразует в формат OpenTelemetry Logs. В нашем случае он читает JSON-логи PostgreSQL, извлекает временную метку и severity, а остальные поля сохраняет как атрибуты.

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

Receiver отслеживает позицию чтения в файле и продолжает с того же места после перезапуска. Поддерживает ротацию файлов и автоматическое обнаружение новых файлов по glob-паттерну.

---

## filelog receiver — ключевые моменты

- `include` — glob-паттерн для файлов логов. Поддерживает wildcards: `*.json` найдёт все JSON-файлы в каталоге. При ротации логов новые файлы подхватываются автоматически
- `start_at: end` — при первом запуске читаем только новые записи, пропуская историю. Для обработки существующих логов можно установить `beginning`
- `json_parser` — парсит каждую строку как JSON и извлекает поля в атрибуты OpenTelemetry. Параметр `parse_ints: true` сохраняет числовые значения как числа, а не строки
- `timestamp` — извлекает временную метку из поля `attributes.timestamp` и парсит её по формату strptime. Это становится основным временем записи в хранилище
- `severity` — маппинг severity PostgreSQL в стандартные уровни OpenTelemetry. PostgreSQL использует свои уровни (LOG, NOTICE, WARNING), которые отличаются от стандартных (INFO, WARN, ERROR)

---

## Что такое VictoriaLogs?

VictoriaLogs — это хранилище логов от команды VictoriaMetrics, спроектированное для эффективного приёма, хранения и поиска по логам. Оно дополняет VictoriaMetrics, образуя единый стек для метрик и логов от одного вендора.

- **Приём данных через OTLP** — поддерживает протокол OpenTelemetry для приёма логов, что позволяет использовать один коллектор для отправки и метрик, и логов
- **Язык запросов LogsQL** — простой и мощный язык для поиска по логам. Поддерживает фильтрацию по полям, полнотекстовый поиск, агрегации и статистику
- **Встроенный UI** — веб-интерфейс для поиска и просмотра логов с поддержкой live-режима (просмотр в реальном времени)
- **Компактное хранение** — эффективное сжатие и индексирование логов, низкое потребление ресурсов

В нашем стенде: `http://localhost:9428` | Документация: [docs.victoriametrics.com/victorialogs](https://docs.victoriametrics.com/victorialogs)

---

## otlphttp/victorialogs exporter

Для отправки логов в VictoriaLogs используется ещё один экземпляр otlphttp exporter. OpenTelemetry Collector позволяет создавать несколько экземпляров одного типа компонента через суффикс после `/` — это называется именованный экземпляр.

```yaml
exporters:
  otlphttp/victorialogs:
    endpoint: http://victorialogs:9428/insert/opentelemetry
    compression: gzip
    encoding: proto
```

- Суффикс `/victorialogs` — именованный экземпляр exporter. Позволяет иметь два otlphttp exporter-а с разными endpoint-ами: один для метрик (VictoriaMetrics), другой для логов (VictoriaLogs)
- Endpoint `/insert/opentelemetry` — специальный путь VictoriaLogs для приёма данных по протоколу OTLP

---

## resource processor — идентификация источника

Resource processor добавляет атрибуты ресурса к каждой записи лога. Эти атрибуты идентифицируют источник данных и используются VictoriaLogs для построения индекса — поле `_stream`, по которому логи группируются и быстро находятся.

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

- `service.name` — имя сервиса. В VictoriaLogs формирует часть `_stream`, по которому можно быстро отфильтровать все логи конкретного сервиса
- `service.instance.id` — идентификатор инстанса. Позволяет различать логи от нескольких PostgreSQL-серверов, если они отправляются в одно хранилище

---

## Пайплайн логов — config-step3

В config-step3 появляется второй, независимый пайплайн — для логов. Пайплайн метрик остаётся без изменений. Два пайплайна работают параллельно в одном коллекторе, каждый со своим набором компонентов.

```yaml
service:
  pipelines:
    metrics:                    # пайплайн метрик (без изменений)
      receivers:  [postgrespro, hostmetrics]
      processors: [memory_limiter/metrics, transform, batch/metrics]
      exporters:  [prometheus, otlphttp]

    logs:                       # новый пайплайн логов
      receivers:  [filelog]
      processors: [resource, attributes/convert, batch/logs]
      exporters:  [otlphttp/victorialogs]
```

Обратите внимание на `attributes/convert` — этот процессор конвертирует числовые атрибуты (query_id, pid) в строки, так как VictoriaLogs ожидает строковые значения для атрибутов.

---
