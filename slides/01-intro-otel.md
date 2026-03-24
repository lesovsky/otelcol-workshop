---
marp: true
theme: default
paginate: true
---

# Мониторинг PostgreSQL с OpenTelemetry

Воркшоп

---

## О чём этот воркшоп

- Настроим полный pipeline мониторинга PostgreSQL
- От сбора метрик и логов — до визуализации
- Все шаги — практические, на рабочем окружении

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

Три столпа наблюдаемости:

- **Метрики** — числовые измерения (CPU, соединения, транзакции)
- **Логи** — записи о событиях (ошибки, checkpoints, медленные запросы)
- **Трейсы** — путь запроса через систему

Сегодня фокус на **метриках** и **логах** PostgreSQL.

---

## Зачем нужен OpenTelemetry?

**Проблема:** множество форматов, протоколов, инструментов

- Prometheus — свой формат метрик
- Elasticsearch — свой формат логов
- Jaeger, Zipkin — свои форматы трейсов
- Каждый инструмент — свой агент, свой конфиг

**Решение:** OpenTelemetry — единый стандарт

---

## OpenTelemetry — ключевые концепции

- **Сигналы** — метрики, логи, трейсы
- **OTLP** — OpenTelemetry Protocol, единый формат передачи
- **SDK** — библиотеки для инструментации приложений
- **Collector** — агент для сбора, обработки и экспорта телеметрии

---

## OpenTelemetry Collector — архитектура

```
              ┌─────────────────────────────────────┐
              │       OpenTelemetry Collector        │
              │                                     │
Данные ──────▸│  Receivers → Processors → Exporters │──────▸ Хранилища
              │                                     │
              └─────────────────────────────────────┘
```

- **Receivers** — откуда собираем данные
- **Processors** — как обрабатываем (фильтрация, обогащение, батчинг)
- **Exporters** — куда отправляем

---

## Receivers — источники данных

Примеры receivers:

| Receiver | Что собирает |
|----------|-------------|
| `otlp` | Данные по протоколу OTLP |
| `prometheus` | Скрейпинг Prometheus-эндпоинтов |
| `hostmetrics` | Метрики ОС (CPU, память, диск) |
| `filelog` | Логи из файлов |
| **`postgrespro`** | Метрики PostgreSQL |

---

## Processors — обработка данных

| Processor | Что делает |
|-----------|-----------|
| `batch` | Группирует данные в пакеты |
| `memory_limiter` | Ограничивает потребление памяти |
| `resource` | Добавляет атрибуты (service.name и т.д.) |
| `attributes` | Преобразует атрибуты (конвертация типов) |
| `filter` | Фильтрует данные по условиям |

---

## Exporters — назначения

| Exporter | Куда отправляет |
|----------|----------------|
| `otlphttp` | По протоколу OTLP через HTTP |
| `prometheus` | Публикует метрики на HTTP-эндпоинте |
| `file` | Записывает данные в файл (для отладки) |

---

## Pipelines — связываем всё вместе

```yaml
service:
  pipelines:
    metrics:                      # пайплайн для метрик
      receivers:  [postgrespro, hostmetrics]
      processors: [memory_limiter]
      exporters:  [otlphttp, prometheus]

    logs:                         # пайплайн для логов
      receivers:  [filelog]
      processors: [resource, batch]
      exporters:  [otlphttp/victorialogs]
```

Каждый сигнал — свой пайплайн.

---

## Архитектура нашего воркшопа

```
┌─────────────┐     ┌────────────────────────┐     ┌──────────────┐     ┌─────────┐
│ PostgreSQL  │◂───▸│  PGPRO OTEL Collector  │     │              │     │         │
│   18        │     │  postgrespro receiver  │────▸│ Victoria     │────▸│ Grafana │
│             │     │  hostmetrics receiver  │────▸│ Metrics      │     │         │
│ pgbench     │     │  filelog receiver      │────▸│ Victoria     │────▸│         │
│ (нагрузка)  │     │  prometheus exp (:8889)│     │ Logs         │     │         │
└─────────────┘     └────────────────────────┘     └──────────────┘     └─────────┘
```

---

## Компоненты стенда

| Сервис | Порт | Назначение |
|--------|------|-----------|
| PostgreSQL 18 | 15432 | БД с pgbench-нагрузкой |
| PGPRO OTEL Collector | 8888, 8889 | Сбор и экспорт телеметрии |
| VictoriaMetrics | 8428 | Хранение метрик |
| VictoriaLogs | 9428 | Хранение логов |
| Grafana | 3000 | Визуализация |

---

## Практика: запуск окружения

Перейдите к разделу 1 в workshop-guide.

```bash
docker compose up -d
```

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Все контейнеры должны быть в статусе `Up`.

---
