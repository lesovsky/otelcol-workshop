# Мониторинг PostgreSQL с OpenTelemetry

Материалы воркшопа для PGConf.Россия 2026.

## О воркшопе

Практический воркшоп (~4 часа) по настройке полного pipeline мониторинга PostgreSQL: от сбора метрик и логов до визуализации в Grafana. Все шаги выполняются на готовом окружении в Docker.

**Целевая аудитория:** DBA, sysadmin, DevOps, SRE.

## Архитектура

![Архитектура воркшопа](images/architecture.png)

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

## Быстрый старт

### Требования

- Docker Engine 24.0+
- Docker Compose V2 (плагин)
- curl, git

### Загрузка образов (рекомендуется сделать заранее)

```bash
docker pull postgres:18
docker pull victoriametrics/victoria-metrics:v1.137.0
docker pull victoriametrics/victoria-logs:v1.47.0
docker pull grafana/grafana:12.4.0
docker pull debian:trixie-slim
```

### Запуск

```bash
git clone https://github.com/lesovsky/otelcol-workshop.git
cd otelcol-workshop
docker compose up -d
```

### Проверка

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Веб-интерфейсы

| Сервис | URL | Описание |
|--------|-----|----------|
| **Workshop App** | http://localhost:8090 | Интерактивный воркшоп — теория, практика, проверки |
| Grafana | http://localhost:3000 | Визуализация (admin / workshop) |
| VictoriaMetrics (VMUI) | http://localhost:8428/vmui | Запросы к метрикам |
| VictoriaLogs (UI) | http://localhost:9428/select/vmui | Поиск по логам |
| Prometheus exporter | http://localhost:8889/metrics | Метрики для проверки |

## Структура репозитория

```
├── docker-compose.yml                      # окружение воркшопа
├── dockerfiles/
│   └── otel-collector/
│       └── Dockerfile                      # сборка PGPRO OTEL Collector
├── configs/
│   ├── otel-collector/
│   │   ├── config-step1.yaml               # шаг 1: метрики → prometheus exporter
│   │   ├── config-step2.yaml               # шаг 2: + otlphttp → VictoriaMetrics
│   │   └── config-step3.yaml               # шаг 3: + filelog → VictoriaLogs
│   ├── postgres/
│   │   └── postgresql.conf                 # PostgreSQL: jsonlog, checkpoints, locks
│   └── grafana/
│       └── provisioning/
│           ├── datasources/
│           │   └── datasources.yaml        # VictoriaMetrics + VictoriaLogs
│           └── dashboards/
│               ├── dashboards.yaml
│               ├── postgresql.json         # основной дашборд
│               ├── healthcheck.json        # healthcheck (RED)
│               ├── databases.json          # статистика баз данных
│               ├── io.json                 # ввод-вывод
│               └── bgwriter.json           # background writer + checkpointer
├── webapp/
│   ├── Dockerfile                          # Node.js + Express
│   ├── server.js                           # бэкенд: статика + API-прокси к сервисам
│   └── public/                             # фронтенд: SPA с навигацией по слайдам
├── guide/
│   └── workshop-guide.md                   # пошаговая инструкция (практика)
├── slides/
│   ├── 01-intro-otel.md                    # введение в OpenTelemetry (кратко)
│   ├── 01-intro-otel.detailed.md           # введение в OpenTelemetry (подробно)
│   ├── 02-pgpro-otel-collector.md          # PGPRO OTEL Collector (кратко)
│   ├── 02-pgpro-otel-collector.detailed.md # PGPRO OTEL Collector (подробно)
│   ├── ...                                 # остальные разделы аналогично
│   └── 07-troubleshooting.md               # траблшутинг (титульный слайд)
└── pgpro-otel-collector-examples/          # примеры конфигов из deb-пакета
```

## Прохождение воркшопа

После `docker compose up -d` откройте **http://localhost:8090** — интерактивное веб-приложение с теорией, практическими шагами и встроенными проверками. Переключатель "Кратко / Подробно" позволяет выбрать уровень детализации. Тёмная и светлая темы.

Альтернативно: [workshop-guide.md](guide/workshop-guide.md) — текстовая пошаговая инструкция.

## Документация

- **[Workshop App](http://localhost:8090)** — интерактивный воркшоп (запускается вместе с окружением)
- **[Workshop Guide](guide/workshop-guide.md)** — текстовая пошаговая инструкция
- **[PGPRO OTEL Collector](https://postgrespro.ru/docs/otelcol)** — документация коллектора
- **[VictoriaMetrics](https://docs.victoriametrics.com/)** — документация VictoriaMetrics
- **[VictoriaLogs](https://docs.victoriametrics.com/victorialogs/)** — документация VictoriaLogs
- **[OpenTelemetry](https://opentelemetry.io/)** — стандарт OpenTelemetry

## Лицензия

Материалы воркшопа распространяются свободно для образовательных целей.
