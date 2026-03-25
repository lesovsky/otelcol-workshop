---
marp: true
theme: default
paginate: true
---

# PGPRO OTEL Collector

Сбор метрик и логов PostgreSQL

---

## Что такое PGPRO OTEL Collector?

PGPRO OTEL Collector — это специализированная сборка OpenTelemetry Collector от компании Postgres Professional, созданная для мониторинга PostgreSQL. В отличие от стандартного Collector, она включает нативный receiver для глубокого сбора метрик PostgreSQL без необходимости писать SQL-запросы вручную.

- **Специализированная сборка OpenTelemetry Collector** — содержит все стандартные компоненты OTel Collector плюс дополнительные, специфичные для PostgreSQL. Устанавливается как единый пакет, не требует сборки из исходников.

- **Разработана Postgres Professional** — компанией, которая разрабатывает Postgres Pro и активно контрибьютит в PostgreSQL. Receiver учитывает особенности внутренней статистики PostgreSQL.

- **Включает postgrespro receiver** — нативный сборщик метрик PostgreSQL с плагинной архитектурой. Каждый плагин отвечает за свою область: активность, WAL, блокировки, кэш, репликация и другие. Подключается к PostgreSQL по TCP и собирает метрики через системные представления.

- **Стандартные компоненты** — hostmetrics (метрики ОС), filelog (сбор логов из файлов), prometheus exporter (публикация метрик), otlphttp exporter (отправка в хранилища) и другие.

Документация: [postgrespro.ru/docs/otelcol](https://postgrespro.ru/docs/otelcol) | Быстрый старт: [Установка и настройка](https://postgrespro.ru/docs/otelcol/current/otelcol-installation.html)

---

## Структура конфигурации

Конфигурация PGPRO OTEL Collector — это YAML-файл, который по умолчанию располагается в `/etc/pgpro-otel-collector/basic.yml`. Файл состоит из четырёх основных секций, каждая из которых отвечает за свой этап обработки телеметрии:

```yaml
receivers:      # откуда собираем данные
processors:     # как обрабатываем
exporters:      # куда отправляем
service:        # пайплайны (связываем всё вместе)
```

Коллектор поддерживает несколько конфигурационных файлов одновременно через флаг `--config`, что позволяет разделять конфигурацию по смысловым блокам.

Откройте файл `configs/otel-collector/config-step1.yaml` — это наша стартовая конфигурация.

Справочник по настройке: [Настройка и конфигурация](https://postgrespro.ru/docs/otelcol/current/otelcol-setup-and-configuration.html)

---

## postgrespro receiver — подключение

Receiver подключается к PostgreSQL по TCP и через системные представления (`pg_stat_activity`, `pg_stat_bgwriter`, `pg_locks` и др.) собирает метрики. Для подключения используются стандартные параметры, знакомые по любому приложению, работающему с PostgreSQL: адрес и порт сервера, имя базы данных, логин и пароль. Пароль передаётся через переменную окружения — никогда не храните секреты в конфигурационных файлах.

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

- `collection_interval` — интервал сбора метрик. 15 секунд — разумный баланс между детализацией и нагрузкой на БД
- `max_threads` — количество параллельных потоков сбора. Каждый плагин выполняет свои SQL-запросы, параллельность ускоряет сбор
- `${env:...}` — подстановка из переменной окружения. В Docker задаётся через `environment` в docker-compose.yml

---

## postgrespro receiver — плагины

Плагины определяют, **какие** метрики собирать. Каждый плагин подключается к определённому набору системных представлений PostgreSQL и генерирует соответствующие метрики. Плагины можно включать и выключать независимо.

| Плагин | Что собирает |
|--------|-------------|
| `activity` | Текущие соединения, активные/idle транзакции, vacuum-процессы, wait events по типам |
| `bgwriter` | Статистика background writer — количество записанных буферов, частота сбросов |
| `cache` | Соотношение cache hit/miss — показывает эффективность shared_buffers |
| `checkpointer` | Контрольные точки — количество, длительность, объём записанных данных |
| `databases` | Транзакции (commits/rollbacks), чтение блоков, temp-файлы, deadlocks, размер БД |
| `locks` | Блокировки по типам и режимам — для выявления конкурентных проблем |
| `wal` | Статистика WAL — объём генерируемых данных, скорость записи |
| `health` | Uptime и время запуска инстанса — для базового healthcheck |

---

## postgrespro receiver — плагины (продолжение)

| Плагин | Что собирает |
|--------|-------------|
| `archiver` | Статистика архивации WAL — количество и время архивации, последние ошибки |
| `io` | Статистика ввода-вывода по типам объектов и контекстам операций |
| `replication` | Состояние репликации на primary — lag, статус подключённых реплик |
| `tablespaces` | Размеры табличных пространств — для отслеживания роста данных |
| `version` | Версия PostgreSQL — полезно для инвентаризации и дашбордов |

Каждый плагин включается в конфиге:

```yaml
plugins:
  activity:
    enabled: true
  wal:
    enabled: true
```

Полный список плагинов и метрик: [Ресиверы](https://postgrespro.ru/docs/otelcol/current/otelcol-receivers.html) | [Каталог метрик](https://postgrespro.ru/docs/otelcol/current/otelcol-metrics.html)

---

## hostmetrics receiver — метрики ОС

Receiver hostmetrics собирает метрики операционной системы через системные интерфейсы (`/proc`, `/sys`). Работает без внешних зависимостей. В Docker для доступа к метрикам хоста необходимо монтировать `/proc` и `/sys` хоста в контейнер.

> **Примечание:** scraper `processes` читает информацию о процессах из `/proc/[pid]/`. Стандартная модель безопасности Linux ограничивает доступ к данным чужих процессов для непривилегированных пользователей. Для полного сбора метрик по процессам (имя, IO, cgroup, exe path) может потребоваться запуск коллектора от root или назначение capability `CAP_SYS_PTRACE`.

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

Документация: [hostmetrics receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/hostmetricsreceiver)

---

## prometheus exporter — проверка метрик

Prometheus exporter публикует все собранные метрики в формате Prometheus на HTTP-эндпоинте. В нашем воркшопе он используется для быстрой проверки — собираются ли метрики и в каком виде.

```yaml
exporters:
  prometheus:
    endpoint: :8889
    send_timestamps: true
```

Публикует все собранные метрики на `http://localhost:8889/metrics`

Используем для проверки: **собираются ли метрики?**

Документация: [prometheus exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/prometheusexporter)

---

## Итоги: PGPRO OTEL Collector

В этом разделе мы разобрали, как устроен PGPRO OTEL Collector и из каких компонентов состоит конфигурация сбора метрик.

- **PGPRO OTEL Collector** — специализированная сборка с нативным PostgreSQL receiver от Postgres Professional
- **postgrespro receiver** — подключается к PostgreSQL по TCP и через системные представления собирает метрики по плагинам (activity, wal, locks, cache и др.)
- **hostmetrics receiver** — собирает метрики ОС (CPU, память, диск, сеть) без внешних зависимостей
- **prometheus exporter** — публикует метрики для проверки на HTTP-эндпоинте
- **Конфигурация** — единый YAML-файл с четырьмя секциями: receivers, processors, exporters, service

Переходим к практике — запустим коллектор и убедимся, что метрики собираются.

---
