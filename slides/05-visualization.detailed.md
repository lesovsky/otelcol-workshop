---
marp: true
theme: default
paginate: true
---

# Визуализация в Grafana

Метрики и логи — в одном интерфейсе

---

## Grafana — единая точка наблюдения

Grafana — это открытая платформа для визуализации и мониторинга, которая объединяет данные из множества источников в единый интерфейс. В нашем воркшопе Grafana подключена одновременно к VictoriaMetrics (метрики) и VictoriaLogs (логи), что позволяет видеть полную картину состояния PostgreSQL в одном месте.

- **Множество datasources** — Grafana поддерживает десятки типов источников данных: Prometheus, PostgreSQL, Elasticsearch, Loki, VictoriaMetrics, VictoriaLogs и другие. Каждый datasource подключается независимо
- **Дашборды** — интерактивные панели с графиками, таблицами, gauges и другими визуализациями. Дашборды можно создавать вручную или импортировать готовые (provisioning)
- **Explore** — интерфейс для ad-hoc запросов к любому datasource. Удобен для расследования инцидентов и поиска по логам
- **Алерты** — правила оповещений на основе запросов к datasources. В нашем воркшопе не рассматриваются, но это важная часть production-использования

В нашем стенде: `http://localhost:3000` | Логин: `admin` / Пароль: `workshop`

---

## Datasources

В нашем стенде два источника данных, настроенных через provisioning (конфигурация применяется автоматически при запуске Grafana, без ручной настройки):

| Datasource | Тип | URL | Данные |
|-----------|-----|-----|--------|
| VictoriaMetrics | Prometheus | `http://victoriametrics:8428` | Метрики PostgreSQL и ОС |
| VictoriaLogs | VictoriaLogs Datasource | `http://victorialogs:9428` | JSON-логи PostgreSQL |

VictoriaMetrics использует тип datasource «Prometheus», так как полностью совместима с PromQL. VictoriaLogs требует отдельный плагин — `victoriametrics-logs-datasource`, который устанавливается автоматически при запуске контейнера.

Проверка: **Connections → Data sources** — должны быть два источника.

---

## Дашборд PostgreSQL Workshop

Дашборд уже импортирован через provisioning и содержит основные метрики PostgreSQL и операционной системы. Все панели используют VictoriaMetrics как datasource и показывают реальную активность, генерируемую pgbench.

| Панель | Метрика | Что показывает |
|--------|---------|---------------|
| PostgreSQL Uptime | `postgresql_health_uptime_milliseconds` | Время работы инстанса |
| Active Connections | `postgresql_activity_connections` | Соединения по состояниям (active, idle) |
| Transactions | `rate(postgresql_databases_commits_total[1m])` | Скорость коммитов в секунду |
| Cache Hit Ratio | `postgresql_cache_hit_ratio` | Эффективность shared_buffers (> 0.9 — норма) |
| WAL Generation | `rate(postgresql_wal_bytes_total[1m])` | Скорость генерации WAL в байтах/с |
| Locks | `postgresql_locks_all_milliseconds` | Блокировки по типам и режимам |
| CPU / Memory | `system_cpu_time_seconds_total`, `system_memory_usage_bytes` | Метрики операционной системы |

Перейдите: **Dashboards → PostgreSQL Workshop**

---
