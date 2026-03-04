# Workshop Plan: Мониторинг PostgreSQL с OpenTelemetry

## Общая информация

- **Формат**: Воркшоп, теория (слайды) + практика (hands-on)
- **Длительность**: ~4 ч 10 мин (с перерывами и Q&A)
- **Аудитория**: DBA, сисадмины, DevOps, SRE
- **Стек**: PostgreSQL 18, PGPRO OTEL Collector, VictoriaMetrics, VictoriaLogs, Grafana

## Программа воркшопа

| # | Часть | Время |
|---|-------|-------|
| 1 | Введение в OpenTelemetry | ~30 мин |
| 2 | PGPRO OTEL Collector — настройка сбора метрик и логов | ~50 мин |
| — | Q&A + перерыв | ~20 мин |
| 3 | Метрики → VictoriaMetrics | ~40 мин |
| 4 | Логи → VictoriaLogs | ~40 мин |
| — | Q&A + перерыв | ~20 мин |
| 5 | Визуализация в Grafana (метрики + логи) | ~40 мин |
| 6 | Итоги и Q&A | ~10 мин |

## Архитектура

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌──────────────────┐     ┌─────────┐
│ PostgreSQL  │     │        PGPRO OTEL Collector          │     │                  │     │         │
│   18        │◂───▸│  ┌─────────────────────────────┐     │     │                  │     │         │
│             │     │  │ postgrespro receiver         │─────────▸│                  │     │         │
│ jsonlog ON  │     │  │ (метрики PG: activity, wal,  │     │     │ VictoriaMetrics  │────▸│         │
│             │     │  │  bgwriter, locks, cache ...) │     │     │ (метрики)        │     │ Grafana │
│ pgbench     │     │  ├─────────────────────────────┤     │     │                  │     │         │
│ (нагрузка)  │     │  │ hostmetrics receiver         │─────────▸│                  │     │         │
│             │     │  │ (cpu, mem, disk, net, load)  │     │     │                  │     │         │
└─────────────┘     │  └─────────────────────────────┘     │     └──────────────────┘     │         │
                    │                                      │                               │         │
  /var/log/pg/*.json│  ┌─────────────────────────────┐     │     ┌──────────────────┐     │         │
       ─────────────│▸ │ filelog receiver             │─────────▸│ VictoriaLogs     │────▸│         │
                    │  │ (JSON-логи PostgreSQL)       │     │     │ (логи)           │     │         │
                    │  └─────────────────────────────┘     │     └──────────────────┘     └─────────┘
                    │  ┌─────────────────────────────┐     │
                    │  │ prometheus exporter (:8889)  │     │  ◂── для проверки (часть 2)
                    │  └─────────────────────────────┘     │
                    └──────────────────────────────────────┘
```

## Структура проекта

```
pgconf-o11y-workshop/
├── PLAN.md
├── docker-compose.yml
├── dockerfiles/
│   └── otel-collector/
│       └── Dockerfile                  # Debian + pgpro-otel-collector deb
├── configs/
│   ├── otel-collector/
│   │   ├── config-step1.yaml           # postgrespro + hostmetrics → prometheus exporter
│   │   ├── config-step2.yaml           # + otlphttp → VictoriaMetrics
│   │   └── config-step3.yaml           # + filelog → VictoriaLogs (финальный)
│   ├── postgres/
│   │   └── postgresql.conf             # jsonlog, log_checkpoints и т.д.
│   └── grafana/
│       └── provisioning/
│           ├── datasources/
│           │   └── datasources.yaml    # VictoriaMetrics + VictoriaLogs
│           └── dashboards/
│               ├── dashboards.yaml     # провижининг дашбордов
│               └── postgresql.json     # дашборд PostgreSQL
├── slides/
│   ├── 01-intro-otel.md
│   ├── 02-pgpro-otel-collector.md
│   ├── 03-victoriametrics.md
│   ├── 04-victorialogs.md
│   └── 05-visualization.md
└── guide/
    └── workshop-guide.md               # пошаговая инструкция для участников
```

---

## Шаг 1. Рабочее окружение

> **Статус: ✅ ГОТОВО**

Цель: полностью работающий стенд, который можно поднять одной командой `docker compose up -d`.

### 1.1 Dockerfile для PGPRO OTEL Collector
- **Статус**: ✅ готово
- **Что делаем**: Dockerfile на базе Debian, установка deb-пакета pgpro-otel-collector
- **Результат**: `dockerfiles/otel-collector/Dockerfile` — собирается, контейнер запускается
- **Критерий готовности**: `docker build` проходит, `pgpro-otel-collector --version` внутри контейнера работает

### 1.2 Конфигурация PostgreSQL
- **Статус**: ✅ готово
- **Что делаем**: Параметры для jsonlog и расширенного логирования
- **Результат**: `configs/postgres/postgresql.conf`
- **Параметры**: `log_destination=jsonlog`, `logging_collector=on`, `log_checkpoints=on`, `log_lock_waits=on`, `log_temp_files=0`
- **Критерий готовности**: PostgreSQL пишет JSON-логи в `/var/log/postgresql/`

### 1.3 Конфиги OTEL Collector (3 шага)
- **Статус**: ✅ готово
- **Что делаем**: Три инкрементальных конфига
- **Результат**: `configs/otel-collector/config-step1.yaml`, `config-step2.yaml`, `config-step3.yaml`

| Конфиг | Receivers | Exporters | Processors |
|--------|-----------|-----------|------------|
| step1 | postgrespro, hostmetrics | prometheus (:8889) | batch, memory_limiter |
| step2 | postgrespro, hostmetrics | prometheus, otlphttp (→VM) | batch, memory_limiter |
| step3 | postgrespro, hostmetrics, filelog | prometheus, otlphttp (→VM), otlphttp/victorialogs | batch, memory_limiter, resource, attributes/convert |

- **Критерий готовности**: Каждый конфиг валиден — коллектор запускается без ошибок

### 1.4 Docker Compose
- **Статус**: ✅ готово
- **Что делаем**: Compose-файл со всеми сервисами
- **Результат**: `docker-compose.yml`

| Сервис | Образ | Порты | Примечания |
|--------|-------|-------|-----------|
| postgres | postgres:18 | 5432 | jsonlog, init pgbench dataset |
| pgbench | postgres:18 | — | непрерывная нагрузка (`pgbench -c 5 -T 86400`) |
| otel-collector | свой Dockerfile | 8888, 8889 | конфиг монтируется как volume |
| victoriametrics | victoriametrics/victoria-metrics | 8428 | single-node |
| victorialogs | victoriametrics/victoria-logs | 9428 | single-node |
| grafana | grafana/grafana | 3000 | provisioning datasources + dashboards |

- **Volumes**: конфиг коллектора, логи PostgreSQL (shared между postgres и otel-collector)
- **Критерий готовности**: `docker compose up -d` — все сервисы healthy

### 1.5 Grafana provisioning
- **Статус**: ✅ готово
- **Что делаем**: Автоматическое подключение datasources и дашборд
- **Результат**: `configs/grafana/provisioning/datasources/datasources.yaml`, дашборд PostgreSQL
- **Критерий готовности**: Grafana стартует с подключёнными VictoriaMetrics и VictoriaLogs, дашборд доступен

### Ревью шага 1
- [ ] Все контейнеры запускаются
- [ ] PostgreSQL пишет JSON-логи
- [ ] pgbench генерирует нагрузку
- [ ] Коллектор с config-step1 показывает метрики на :8889/metrics
- [ ] Коллектор с config-step3 отправляет метрики в VictoriaMetrics и логи в VictoriaLogs
- [ ] Grafana показывает данные на дашборде

---

## Шаг 2. Инструкция для участников

> **Статус: ✅ ГОТОВО**

Цель: пошаговый гайд, по которому участник может пройти весь воркшоп самостоятельно.

### 2.1 Введение и подготовка окружения
- **Статус**: ✅ готово
- **Что делаем**: Раздел с описанием архитектуры, требованиями, запуском окружения
- **Результат**: Секция в `guide/workshop-guide.md`
- **Содержание**: Схема стенда, как запустить, как проверить что всё работает

### 2.2 Практика: настройка PGPRO OTEL Collector
- **Статус**: ✅ готово
- **Что делаем**: Пошаговая инструкция по настройке config-step1
- **Результат**: Секция в workshop-guide.md
- **Содержание**: Объяснение структуры конфига, postgrespro receiver (какие плагины, зачем), hostmetrics receiver, prometheus exporter, запуск и проверка через `curl :8889/metrics` и логи коллектора

### 2.3 Практика: интеграция с VictoriaMetrics
- **Статус**: ✅ готово
- **Что делаем**: Инструкция по переходу к config-step2
- **Результат**: Секция в workshop-guide.md
- **Содержание**: Добавление otlphttp exporter, перезапуск коллектора, проверка через VMUI (`http://localhost:8428/vmui`)

### 2.4 Практика: интеграция с VictoriaLogs
- **Статус**: ✅ готово
- **Что делаем**: Инструкция по переходу к config-step3
- **Результат**: Секция в workshop-guide.md
- **Содержание**: Добавление filelog receiver + otlphttp/victorialogs exporter, ресурсные атрибуты, перезапуск, проверка через VictoriaLogs UI (`http://localhost:9428/select/vmui`)

### 2.5 Практика: визуализация в Grafana
- **Статус**: ✅ готово
- **Что делаем**: Инструкция по работе с Grafana
- **Результат**: Секция в workshop-guide.md
- **Содержание**: Обзор подключённых datasources, импорт/обзор дашборда метрик, просмотр логов через VictoriaLogs datasource, построение простых панелей

### 2.6 Траблшутинг
- **Статус**: ✅ готово
- **Что делаем**: Раздел с типичными проблемами и решениями
- **Результат**: Секция в workshop-guide.md
- **Содержание**: Коллектор не стартует, метрики не появляются, логи не доходят, Grafana не показывает данные

### Ревью шага 2
- [ ] Инструкция покрывает все части программы
- [ ] Каждый шаг имеет конкретное действие и способ проверки результата
- [ ] Траблшутинг покрывает типичные ошибки
- [ ] Новый участник может пройти гайд от начала до конца без дополнительных вопросов

---

## Шаг 3. Слайды

> **Статус: ✅ ГОТОВО**

Цель: набор слайдов в Markdown (Marp) для теоретических блоков каждой части воркшопа.

### 3.1 Слайды: Введение в OpenTelemetry
- **Статус**: ✅ готово
- **Файл**: `slides/01-intro-otel.md`
- **Содержание**: Что такое Observability (метрики, логи, трейсы). Зачем нужен OpenTelemetry. Ключевые концепции: сигналы, SDK, Collector. Архитектура OpenTelemetry Collector (receivers → processors → exporters → pipelines). Форматы: OTLP, совместимость. Общая схема воркшопа.
- **Примерный объём**: 10-15 слайдов

### 3.2 Слайды: PGPRO OTEL Collector
- **Статус**: ✅ готово
- **Файл**: `slides/02-pgpro-otel-collector.md`
- **Содержание**: Что такое PGPRO OTEL Collector и чем отличается от ванильного. Какие метрики PostgreSQL собирает (плагины). Метрики ОС через hostmetrics. Сбор логов через filelog. Структура конфига. Проверка работы: логи коллектора, prometheus exporter.
- **Примерный объём**: 12-18 слайдов

### 3.3 Слайды: VictoriaMetrics
- **Статус**: ✅ готово
- **Файл**: `slides/03-victoriametrics.md`
- **Содержание**: Что такое VictoriaMetrics (кратко). OTLP ingestion. Как коллектор передаёт метрики. VMUI — проверка данных.
- **Примерный объём**: 6-10 слайдов

### 3.4 Слайды: VictoriaLogs
- **Статус**: ✅ готово
- **Файл**: `slides/04-victorialogs.md`
- **Содержание**: Что такое VictoriaLogs. OTLP ingestion для логов. Streams и структура логов. VictoriaLogs UI — поиск и фильтрация.
- **Примерный объём**: 6-10 слайдов

### 3.5 Слайды: Визуализация в Grafana
- **Статус**: ✅ готово
- **Файл**: `slides/05-visualization.md`
- **Содержание**: Grafana как единый интерфейс. Datasource VictoriaMetrics. Datasource VictoriaLogs. Дашборды для метрик PostgreSQL. Explore для логов. Итоговая картина: от PostgreSQL до графика.
- **Примерный объём**: 8-12 слайдов

### Ревью шага 3
- [ ] Слайды соответствуют программе и инструкции
- [ ] Теория → практика: каждый блок слайдов завершается переходом к практике
- [ ] Схемы и диаграммы наглядны
- [ ] Нет перегруза текстом — ключевые тезисы, иллюстрации, примеры конфигов

---

## Порядок работы

```
Шаг 1 (окружение) ──▸ ревью ──▸ Шаг 2 (инструкция) ──▸ ревью ──▸ Шаг 3 (слайды) ──▸ ревью
```

Каждый шаг завершается ревью перед переходом к следующему.
