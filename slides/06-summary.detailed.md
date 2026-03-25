---
marp: true
theme: default
paginate: true
---

# Итоги и что дальше

---

## Что мы сделали на воркшопе

- **Развернули полный pipeline мониторинга** — от PostgreSQL через PGPRO OTEL Collector до хранилищ и визуализации. Все компоненты работают в Docker-контейнерах и связаны через Docker-сеть
- **Настроили сбор метрик PostgreSQL** — postgrespro receiver с 13 плагинами собирает ~300+ метрик: активность, WAL, блокировки, кэш, транзакции, репликация и другие
- **Настроили сбор метрик ОС** — hostmetrics receiver собирает CPU, память, диск, сеть, load average контейнера с PostgreSQL
- **Настроили сбор JSON-логов** — filelog receiver читает структурированные логи PostgreSQL, парсит timestamp и severity, передаёт все поля как атрибуты
- **Отправили метрики в VictoriaMetrics** — через otlphttp exporter с transform processor для корректных имён метрик
- **Отправили логи в VictoriaLogs** — через otlphttp/victorialogs exporter с resource processor для идентификации источника
- **Построили визуализацию в Grafana** — дашборд с метриками PostgreSQL и ОС, Explore для поиска по логам, панель ошибок на дашборде

---

## Что ещё умеет PGPRO OTEL Collector

Мы рассмотрели лишь часть возможностей. За рамками воркшопа остались:

- **Дополнительные receivers** — journald для системных логов, sqlquery для произвольных SQL-запросов
- **Дополнительные processors** — filter для отсеивания ненужных данных, metricstransform для переименования метрик
- **Дополнительные exporters** — kafka для потоковой обработки, zabbix для интеграции с существующим мониторингом
- **Плагины метрик** — statements (pg_stat_statements), tables, indexes, bloat, buffercache, functions и другие
- **Продвинутые плагины** — replication_slots, subscriptions, prepared_transactions, sequences, recovery
- **Безопасность** — TLS-шифрование, Basic Auth, ACL-списки для фильтрации объектов мониторинга
- **Интеграции** — PPEM (Postgres Pro Enterprise Manager), Zabbix, Kafka

Подробнее — на следующих слайдах.

---

## Дополнительные receivers

| Receiver | Что делает |
|----------|-----------|
| `journald` | Чтение логов из systemd journal — альтернатива filelog для серверов с systemd. Поддерживает фильтрацию по unit, priority и другим полям journal |
| `sqlquery` | Выполнение произвольных SQL-запросов для сбора метрик и логов. Позволяет собирать любые данные из PostgreSQL — достаточно написать SELECT-запрос и описать маппинг результата в метрики |

`sqlquery` особенно полезен для кастомных метрик: размеры конкретных таблиц, количество записей в очередях, бизнес-метрики из прикладных таблиц.

---

## Дополнительные processors

| Processor | Что делает |
|-----------|-----------|
| `filter` | Фильтрация данных по условиям — позволяет отбросить (drop) или оставить (include) метрики и логи по имени, значению атрибутов или severity. Полезно для уменьшения объёма данных в production |
| `transform` | Трансформация телеметрии через OTTL-выражения — мощный язык для произвольных преобразований: изменение имён, значений, добавление атрибутов по условиям |
| `metricstransform` | Переименование, агрегация и масштабирование метрик — позволяет привести имена к нужной конвенции или объединить несколько метрик в одну |

В production эти процессоры помогают уменьшить кардинальность метрик, убрать шум из логов и привести данные к единому формату.

---

## Дополнительные exporters

| Exporter | Куда отправляет |
|----------|----------------|
| `kafka` | Apache Kafka — для построения сложных pipeline с потоковой обработкой. Данные можно читать из Kafka другими потребителями для обогащения, агрегации или маршрутизации |
| `zabbix` | Zabbix — интеграция с существующей инфраструктурой мониторинга. Позволяет отправлять метрики из OTel Collector в Zabbix без установки Zabbix Agent |

Можно комбинировать несколько exporters в одном pipeline: одни данные в VictoriaMetrics для долгосрочного хранения, другие — в Kafka для real-time обработки, третьи — в Zabbix для алертинга.

---

## Плагины метрик — не рассмотренные

| Плагин | Что собирает |
|--------|-------------|
| `statements` | pg_stat_statements — статистика запросов: время выполнения, количество вызовов, средний и максимальный latency. Ключевой плагин для анализа производительности |
| `indexes` | Использование индексов — idx_scan, idx_tup_read, размер. Помогает выявить неиспользуемые индексы и кандидатов на оптимизацию |
| `tables` | Статистика таблиц — seq scan vs idx scan, live/dead tuples, autovacuum. Базовая информация о состоянии таблиц |
| `bloat` | Раздувание (bloat) таблиц и индексов — оценка неиспользуемого пространства. Сигнал для запуска VACUUM FULL или pg_repack |
| `buffercache` | pg_buffercache — содержимое shared buffers по объектам. Показывает, какие таблицы и индексы занимают кэш |
| `functions` | Статистика пользовательских функций — количество вызовов, суммарное и среднее время выполнения |

---

## Плагины метрик — продвинутые

| Плагин | Что собирает |
|--------|-------------|
| `replication_slots` | Слоты репликации — состояние, lag, активность. Критично для мониторинга logical replication и предотвращения распухания WAL |
| `subscriptions` | Логическая репликация (подписки) — состояние подписки, lag, количество обработанных транзакций |
| `prepared_transactions` | Подготовленные (двухфазные) транзакции — количество и возраст. Забытые prepared transactions блокируют VACUUM |
| `sequences` | Использование последовательностей — текущее значение, оставшийся запас до переполнения (для bigint — тоже конечен) |
| `recovery` | Статистика восстановления — для standby-серверов: позиция воспроизведения, lag от primary |
| `biha` | BiHA (Built-in High Availability) — встроенная высокая доступность Postgres Pro Enterprise |

---

## Безопасность и ACL

- **TLS** — шифрование соединений с хранилищами (ca_file, cert_file, key_file). В production обязательно для передачи метрик и логов по сети
- **Basic Auth** — аутентификация через htpasswd для защиты API VictoriaMetrics и VictoriaLogs от несанкционированного доступа
- **ACL-списки** — фильтрация объектов мониторинга по базам данных, схемам, таблицам, индексам и функциям. Поддерживает allow/deny списки с регулярными выражениями

```yaml
receivers:
  postgrespro:
    acl:
      databases:
        deny:
          - name: template0
          - name: template1
    plugins:
      tables:
        databases:
          - name: mydb
```

---

## Интеграции

- **PPEM** (Postgres Pro Enterprise Manager) — централизованное управление кластерами Postgres Pro. PGPRO OTEL Collector интегрирован с PPEM для автоматического обнаружения и мониторинга инстансов — [postgrespro.ru/products/postgrespro-enterprise-manager](https://postgrespro.ru/products/postgrespro-enterprise-manager)
- **Zabbix** — экспорт метрик в существующую инфраструктуру мониторинга через zabbix exporter. Позволяет использовать OTel Collector как замену Zabbix Agent для PostgreSQL — [zabbix.com](https://www.zabbix.com)
- **Kafka** — потоковая обработка телеметрии. Метрики и логи отправляются в Kafka, откуда могут быть прочитаны другими потребителями для обогащения, алертинга или долгосрочного хранения — [kafka.apache.org](https://kafka.apache.org)

---

## Полезные ссылки

**PostgreSQL:**

- [postgresql.org/docs/current/monitoring-stats.html](https://www.postgresql.org/docs/current/monitoring-stats.html) — системные представления статистики PostgreSQL (pg_stat_activity, pg_stat_bgwriter и др.)
- [postgresql.org/docs/current/runtime-config-logging.html](https://www.postgresql.org/docs/current/runtime-config-logging.html) — настройка логирования PostgreSQL (jsonlog, csvlog, параметры)
- [postgresql.org/docs/current/pgstatstatements.html](https://www.postgresql.org/docs/current/pgstatstatements.html) — pg_stat_statements: статистика запросов

**PGPRO OTEL Collector:**

- [postgrespro.ru/docs/otelcol](https://postgrespro.ru/docs/otelcol) — документация PGPRO OTEL Collector
- [postgrespro.ru/docs/otelcol/current/otelcol-receivers.html](https://postgrespro.ru/docs/otelcol/current/otelcol-receivers.html) — receivers и плагины
- [postgrespro.ru/docs/otelcol/current/otelcol-metrics.html](https://postgrespro.ru/docs/otelcol/current/otelcol-metrics.html) — каталог метрик
- [postgrespro.ru/docs/otelcol/current/otelcol-installation.html](https://postgrespro.ru/docs/otelcol/current/otelcol-installation.html) — установка и быстрый старт

**Хранилища и визуализация:**

- [docs.victoriametrics.com](https://docs.victoriametrics.com) — VictoriaMetrics: хранилище метрик
- [docs.victoriametrics.com/victorialogs](https://docs.victoriametrics.com/victorialogs) — VictoriaLogs: хранилище логов
- [docs.victoriametrics.com/metricsql](https://docs.victoriametrics.com/metricsql) — MetricsQL: расширенный язык запросов (надмножество PromQL)
- [prometheus.io/docs/prometheus/latest/querying/basics](https://prometheus.io/docs/prometheus/latest/querying/basics/) — PromQL: основы языка запросов
- [grafana.com/docs/grafana/latest](https://grafana.com/docs/grafana/latest/) — Grafana: документация

**OpenTelemetry:**

- [opentelemetry.io](https://opentelemetry.io) — проект OpenTelemetry
- [opentelemetry.io/docs/collector](https://opentelemetry.io/docs/collector/) — документация OpenTelemetry Collector
- [github.com/open-telemetry/opentelemetry-collector-contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib) — receivers, processors, exporters (contrib)

---

## Спасибо!

Вопросы?

---
