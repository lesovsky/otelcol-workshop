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
- Поддержка множества datasources
- Дашборды, алерты, Explore

В нашем стенде: `http://localhost:3000`
Логин: `admin` / Пароль: `workshop`

---

## Datasources

Два источника данных (настроены через provisioning):

| Datasource | Тип | URL | Данные |
|-----------|-----|-----|--------|
| VictoriaMetrics | Prometheus | `http://victoriametrics:8428` | Метрики |
| VictoriaLogs | VictoriaLogs | `http://victorialogs:9428` | Логи |

Проверка: **Connections → Data sources**

---

## Дашборд PostgreSQL Workshop

Дашборд уже импортирован. Перейдите: **Dashboards → PostgreSQL Workshop**

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

## Практика: просмотр дашборда

Перейдите к разделу 5.2 в workshop-guide.

- Откройте **Dashboards → PostgreSQL Workshop**
- Графики показывают реальную активность (pgbench)
- Обратите внимание на Active Connections и Transactions

---

## Explore — логи

Перейдите к разделу 5.3 в workshop-guide.

1. Откройте **Explore** (иконка компаса)
2. Выберите datasource **VictoriaLogs**
3. Запрос: `*`
4. Нажмите **Run query**

---

## Полезные запросы для логов в Explore

| Запрос | Что показывает |
|--------|---------------|
| `*` | Все логи |
| `error_severity:ERROR` | Только ошибки |
| `error_severity:WARNING` | Предупреждения |
| `_msg:"checkpoint"` | Логи контрольных точек |
| `_msg:"connection"` | Логи подключений |
| `_msg:"lock"` | Логи блокировок |

---

## Практика: панель логов на дашборде

Перейдите к разделу 5.4 в workshop-guide.

1. Откройте дашборд **PostgreSQL Workshop**
2. **Add → Visualization**
3. Datasource: **VictoriaLogs**
4. Тип: **Logs**
5. Запрос: `error_severity:ERROR OR error_severity:WARNING`
6. Сохраните панель

Метрики и логи — на одном дашборде.

---

## Итоговая картина

```
PostgreSQL ──▸ PGPRO OTEL Collector ──▸ VictoriaMetrics ──▸ Grafana
  (jsonlog)    postgrespro receiver      (метрики)           (дашборды)
  (pgbench)    hostmetrics receiver
               filelog receiver    ────▸ VictoriaLogs   ──▸ Grafana
               prometheus exp (:8889)    (логи)             (Explore)
```

Единый pipeline: сбор → обработка → хранение → визуализация.

---
