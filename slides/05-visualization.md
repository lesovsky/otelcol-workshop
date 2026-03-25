---
marp: true
theme: default
paginate: true
---

# Визуализация в Grafana

Метрики и логи — в одном интерфейсе

---

## Grafana — единая точка наблюдения

- Открытая платформа для визуализации
- Множество datasources (Prometheus, VictoriaLogs и др.)
- Дашборды, алерты, Explore

В нашем стенде: `http://localhost:3000`
Логин: `admin` / Пароль: `workshop`

---

## Datasources

| Datasource | Тип | URL | Данные |
|-----------|-----|-----|--------|
| VictoriaMetrics | Prometheus | `http://victoriametrics:8428` | Метрики |
| VictoriaLogs | VictoriaLogs | `http://victorialogs:9428` | Логи |

Настроены через provisioning. Проверка: **Connections → Data sources**

---

## Дашборд PostgreSQL Workshop

Перейдите: **Dashboards → PostgreSQL Workshop**

| Панель | Что показывает |
|--------|---------------|
| PostgreSQL Uptime | Время работы |
| Active Connections | Соединения по состояниям |
| Transactions | Скорость коммитов |
| Cache Hit Ratio | Эффективность кэша |
| WAL Generation | Скорость генерации WAL |
| Locks | Блокировки по типам |
| CPU / Memory | Метрики ОС |

---
