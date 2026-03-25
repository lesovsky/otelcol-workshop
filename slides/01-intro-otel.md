---
marp: true
theme: default
paginate: true
---

# Мониторинг PostgreSQL с OpenTelemetry

Воркшоп

---

## О воркшопе

- Настроим полный pipeline мониторинга PostgreSQL
- От сбора метрик и логов — до визуализации в Grafana
- Все шаги — практические, на рабочем окружении
- Стек: PGPRO OTEL Collector → VictoriaMetrics + VictoriaLogs → Grafana

---

## Программа

| # | Часть | Время |
|---|-------|-------|
| 1 | Введение в OpenTelemetry | ~30 мин |
| 2 | PGPRO OTEL Collector — сбор метрик и логов | ~50 мин |
| — | Q&A + перерыв | ~20 мин |
| 3 | Метрики → VictoriaMetrics | ~40 мин |
| 4 | Логи → VictoriaLogs | ~40 мин |
| — | Q&A + перерыв | ~20 мин |
| 5 | Визуализация в Grafana | ~40 мин |
| 6 | Итоги и Q&A | ~10 мин |

---

## Что такое Observability?

Observability — способность понять состояние системы по её внешним сигналам.

- **Метрики** — числовые измерения: CPU, соединения, транзакции
- **Логи** — записи о событиях: ошибки, checkpoints, медленные запросы
- **Трейсы** — путь запроса через систему

Фокус воркшопа: **метрики** и **логи** PostgreSQL.

---

## Зачем нужен OpenTelemetry?

**Проблема:** множество несовместимых инструментов, форматов и агентов.

- Prometheus, Elasticsearch, Jaeger, Zabbix, Datadog — у каждого свой протокол
- На одном сервере могут работать 3-4 агента

**Решение:** OpenTelemetry — единый стандарт, один агент, один протокол (OTLP).

---

## OpenTelemetry — ключевые концепции

- **Сигналы** — метрики, логи, трейсы
- **OTLP** — единый протокол передачи (gRPC/HTTP)
- **SDK** — библиотеки для инструментации приложений
- **Collector** — агент для сбора, обработки и экспорта телеметрии

---

## OpenTelemetry Collector — архитектура

```
  ┌────────────────────────────────────────────────────────┐
  │               OpenTelemetry Collector                   │
  │                                                        │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
  │  │  Receivers   │─▸│  Processors  │─▸│  Exporters   │───▸ Хранилища
  │  └──────────────┘  └──────────────┘  └──────────────┘ │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

- **Receivers** — откуда собираем данные
- **Processors** — фильтрация, обогащение, батчинг
- **Exporters** — куда отправляем

---

## Receivers — источники данных

| Receiver | Что собирает |
|----------|-------------|
| **`postgrespro`** | Метрики PostgreSQL |
| `hostmetrics` | Метрики ОС (CPU, память, диск) |
| `filelog` | Логи из файлов |
| `otlp` | Данные по протоколу OTLP |
| `prometheus` | Скрейпинг Prometheus-эндпоинтов |

---

## Processors — обработка данных

| Processor | Что делает |
|-----------|-----------|
| `batch` | Группирует данные в пакеты |
| `memory_limiter` | Ограничивает потребление памяти |
| `resource` | Добавляет атрибуты (service.name) |
| `transform` | Трансформация через OTTL-выражения |
| `filter` | Фильтрация по условиям |

---

## Exporters — назначения

| Exporter | Куда отправляет |
|----------|----------------|
| `otlphttp` | По протоколу OTLP через HTTP |
| `prometheus` | Публикует метрики на HTTP-эндпоинте |
| `file` | Записывает данные в файл |

---

## Pipelines — связываем всё вместе

```yaml
service:
  pipelines:
    metrics:
      receivers:  [postgrespro, hostmetrics]
      processors: [memory_limiter]
      exporters:  [otlphttp, prometheus]
    logs:
      receivers:  [filelog]
      processors: [resource, batch]
      exporters:  [otlphttp/victorialogs]
```

Каждый сигнал — свой пайплайн.

---

## Архитектура воркшопа

```
┌─────────────┐     ┌────────────────────────┐     ┌──────────────┐     ┌─────────┐
│ PostgreSQL  │◂───▸│  PGPRO OTEL Collector  │     │              │     │         │
│   18        │     │  postgrespro receiver  │────▸│ Victoria     │────▸│ Grafana │
│             │     │  hostmetrics receiver  │────▸│ Metrics      │     │         │
└─────────────┘     │  filelog receiver      │────▸│ Victoria     │────▸│         │
       ▲            │  prometheus exp (:8889)│     │ Logs         │     │         │
       │            └────────────────────────┘     └──────────────┘     └─────────┘
┌──────┴──────┐
│   pgbench   │
│  (нагрузка) │
└─────────────┘
```

---

## Порты сервисов

| Сервис | Порт | Назначение |
|--------|------|-----------|
| PostgreSQL 18 | 15432 | БД с pgbench-нагрузкой |
| PGPRO OTEL Collector | 8888, 8889 | Сбор и экспорт телеметрии |
| VictoriaMetrics | 8428 | Хранение метрик |
| VictoriaLogs | 9428 | Хранение логов |
| Grafana | 3000 | Визуализация |

---

## Итоги

- OpenTelemetry — единый стандарт для метрик, логов и трейсов
- Collector: Receivers → Processors → Exporters
- PGPRO OTEL Collector — нативный сбор метрик PostgreSQL
- Стек: PostgreSQL → Collector → VictoriaMetrics/Logs → Grafana

---
