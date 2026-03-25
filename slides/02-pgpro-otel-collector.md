---
marp: true
theme: default
paginate: true
---

# PGPRO OTEL Collector

Сбор метрик и логов PostgreSQL

---

## Что такое PGPRO OTEL Collector?

- Специализированная сборка OpenTelemetry Collector от Postgres Professional
- Включает **postgrespro receiver** — нативный сбор метрик PostgreSQL
- Стандартные компоненты: hostmetrics, filelog, exporters
- Устанавливается как единый пакет

---

## Структура конфигурации

```yaml
receivers:      # откуда собираем данные
processors:     # как обрабатываем
exporters:      # куда отправляем
service:        # пайплайны
```

Конфиг по умолчанию: `/etc/pgpro-otel-collector/basic.yml`

---

## postgrespro receiver — подключение

```yaml
receivers:
  postgrespro:
    transport: tcp
    endpoint: postgres:5432
    database: postgres
    username: postgres
    password: ${env:POSTGRESQL_PASSWORD}
    collection_interval: 15s
    max_threads: 3
```

---

## postgrespro receiver — плагины

| Плагин | Что собирает |
|--------|-------------|
| `activity` | Соединения, vacuums, wait events |
| `bgwriter` | Background writer |
| `cache` | Cache hit/miss ratio |
| `checkpointer` | Контрольные точки |
| `databases` | Транзакции, блоки, temp-файлы |
| `locks` | Блокировки |
| `wal` | Статистика WAL |
| `health` | Uptime и время запуска |

---

## postgrespro receiver — плагины (продолжение)

| Плагин | Что собирает |
|--------|-------------|
| `archiver` | Статистика архивации WAL |
| `io` | Статистика ввода-вывода |
| `replication` | Репликация (для primary) |
| `tablespaces` | Размеры табличных пространств |
| `version` | Версия PostgreSQL |

```yaml
plugins:
  activity:
    enabled: true
  wal:
    enabled: true
```

---

## hostmetrics receiver — метрики ОС

```yaml
receivers:
  hostmetrics:
    collection_interval: 15s
    scrapers:
      cpu:
      disk:
      filesystem:
      load:
      memory:
      network:
      paging:
      processes:
```

---

## prometheus exporter — проверка метрик

```yaml
exporters:
  prometheus:
    endpoint: :8889
    send_timestamps: true
```

Публикует метрики на `http://localhost:8889/metrics`

---
