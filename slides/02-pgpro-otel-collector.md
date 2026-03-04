---
marp: true
theme: default
paginate: true
---

# PGPRO OTEL Collector

Сбор метрик и логов PostgreSQL

---

## Что такое PGPRO OTEL Collector?

- Специализированная сборка OpenTelemetry Collector
- Разработана Postgres Professional
- Включает **postgrespro receiver** — нативный сборщик метрик PostgreSQL
- Плюс стандартные компоненты: hostmetrics, filelog, exporters

---

## Структура конфигурации

```yaml
receivers:      # откуда собираем данные
processors:     # как обрабатываем
exporters:      # куда отправляем
service:        # пайплайны (связываем всё вместе)
```

Откройте файл `configs/otel-collector/config-step1.yaml`

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

- `collection_interval` — как часто собирать метрики
- `${env:...}` — пароль из переменной окружения (не в конфиге!)

---

## postgrespro receiver — плагины

Плагины определяют, **какие** метрики собирать:

| Плагин | Что собирает |
|--------|-------------|
| `activity` | Соединения, vacuums, wait events |
| `bgwriter` | Background writer |
| `cache` | Cache hit/miss ratio |
| `checkpointer` | Контрольные точки |
| `databases` | Транзакции, блоки, temp-файлы |
| `locks` | Блокировки |
| `wal` | Статистика WAL |
| `health` | Uptime, здоровье инстанса |

---

## postgrespro receiver — плагины (продолжение)

| Плагин | Что собирает |
|--------|-------------|
| `archiver` | Статистика архивации WAL |
| `io` | Статистика ввода-вывода |
| `replication` | Репликация (для primary) |
| `tablespaces` | Размеры табличных пространств |
| `version` | Версия PostgreSQL |

Каждый плагин включается в конфиге:

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
      cpu:            # использование CPU
      disk:           # дисковый I/O
      filesystem:     # использование файловых систем
      load:           # средняя нагрузка
      memory:         # использование памяти
      network:        # сетевой I/O
      paging:         # своппинг
      processes:      # количество процессов
```

---

## prometheus exporter — проверка метрик

```yaml
exporters:
  prometheus:
    endpoint: :8889
    send_timestamps: true
```

Публикует все собранные метрики на `http://localhost:8889/metrics`

Используем для проверки: **собираются ли метрики?**

---

## Пайплайн — config-step1

```yaml
service:
  pipelines:
    metrics:
      receivers:
        - postgrespro       # метрики PostgreSQL
        - hostmetrics       # метрики ОС
      processors:
        - memory_limiter/metrics
        - batch/metrics
      exporters:
        - prometheus        # публикация для проверки
```

`receivers` → `processors` → `exporters`

---

## Практика: проверяем сбор метрик

Перейдите к разделу 2.5 в workshop-guide.

**Логи коллектора:**
```bash
docker logs workshop-otel-collector 2>&1 | grep "Everything is ready"
```

**Метрики PostgreSQL:**
```bash
curl -s http://localhost:8889/metrics | grep "^postgresql_" | head -10
```

**Подсчёт метрик:**
```bash
curl -s http://localhost:8889/metrics | grep -c "^postgresql_"
```

Ожидаем ~300+ метрик.

---

## Что мы получили

- **postgrespro receiver** собирает метрики PostgreSQL (activity, wal, bgwriter, locks, cache...)
- **hostmetrics receiver** собирает метрики ОС (cpu, memory, disk...)
- **prometheus exporter** публикует метрики для проверки
- Метрики доступны на `http://localhost:8889/metrics`

Следующий шаг — отправка метрик в хранилище.

---
