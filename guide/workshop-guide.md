# Workshop Guide: Мониторинг PostgreSQL с OpenTelemetry

## Содержание

0. [Подготовка рабочего места](#0-подготовка-рабочего-места)
1. [Подготовка окружения](#1-подготовка-окружения)
2. [Настройка PGPRO OTEL Collector](#2-настройка-pgpro-otel-collector)
3. [Интеграция с VictoriaMetrics](#3-интеграция-с-victoriametrics)
4. [Интеграция с VictoriaLogs](#4-интеграция-с-victorialogs)
5. [Визуализация в Grafana](#5-визуализация-в-grafana)
6. [Траблшутинг](#6-траблшутинг)

---

## 0. Подготовка рабочего места

Перед началом воркшопа убедитесь, что на вашей рабочей станции установлены следующие инструменты.

### Обязательные

| Инструмент | Минимальная версия | Проверка |
|------------|-------------------|----------|
| Docker Engine | 24.0+ | `docker --version` |
| Docker Compose | 2.20+ (плагин V2) | `docker compose version` |
| curl | любая | `curl --version` |
| git | любая | `git --version` |

### Установка Docker (если не установлен)

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# перелогиньтесь, чтобы применились права группы docker
```

**macOS:**
Установите [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/).

**Windows:**
Установите [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/) с поддержкой WSL 2.

### Рекомендуемые

- **Текстовый редактор** — для просмотра и редактирования YAML-конфигов (VS Code, vim, nano и т.д.)
- **Веб-браузер** — для работы с Grafana, VMUI, VictoriaLogs UI

### Проверка готовности

Выполните команды и убедитесь, что ошибок нет:

```bash
docker --version
docker compose version
curl --version
```

Убедитесь, что Docker-демон запущен:

```bash
docker info > /dev/null 2>&1 && echo "Docker работает" || echo "Docker не запущен!"
```

### Получение материалов воркшопа

```bash
git clone https://github.com/lesovsky/otelcol-workshop.git
cd otelcol-workshop
```

> **Важно:** Первый запуск загрузит Docker-образы (~2 ГБ). Рекомендуется скачать их **заранее**, чтобы не зависеть от интернета на площадке:
>
> ```bash
> docker pull postgres:18
> docker pull victoriametrics/victoria-metrics:v1.137.0
> docker pull victoriametrics/victoria-logs:v1.47.0
> docker pull grafana/grafana:12.4.0
> docker pull debian:bookworm-slim
> ```
>
> Образ PGPRO OTEL Collector будет собран локально на воркшопе из Dockerfile.

---

## 1. Подготовка окружения

### Архитектура стенда

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌──────────────────┐     ┌─────────┐
│ PostgreSQL  │     │        PGPRO OTEL Collector          │     │                  │     │         │
│   18        │◂───▸│  ┌──────────────────────────────┐    │     │                  │     │         │
│             │     │  │ postgrespro receiver         │─────────▸│                  │     │         │
│ jsonlog ON  │     │  │ (метрики PG: activity, wal,  │    │     │ VictoriaMetrics  │────▸│         │
│             │     │  │  bgwriter, locks, cache ...) │    │     │ (метрики)        │     │ Grafana │
│ pgbench     │     │  ├──────────────────────────────┤    │     │                  │     │         │
│ (нагрузка)  │     │  │ hostmetrics receiver         │─────────▸│                  │     │         │
│             │     │  │ (cpu, mem, disk, net, load)  │    │     │                  │     │         │
└─────────────┘     │  └──────────────────────────────┘    │     └──────────────────┘     │         │
                    │                                      │                              │         │
  /var/log/pg/*.json│  ┌──────────────────────────────┐    │     ┌──────────────────┐     │         │
       ─────────────│▸ │ filelog receiver             │─────────▸│ VictoriaLogs     │────▸│         │
                    │  │ (JSON-логи PostgreSQL)       │    │     │ (логи)           │     │         │
                    │  └──────────────────────────────┘    │     └──────────────────┘     └─────────┘
                    │  ┌──────────────────────────────┐    │
                    │  │ prometheus exporter (:8889)  │    │  ◂── для проверки
                    │  └──────────────────────────────┘    │
                    └──────────────────────────────────────┘
```

### Компоненты стенда

> **Внимание:** Перечисленные порты должны быть свободны на вашей машине. Если какой-либо порт занят другим сервисом, контейнер не запустится. Проверить занятость порта можно командой `ss -tlnp | grep <порт>`.

| Сервис | Порт | Назначение |
|--------|------|-----------|
| PostgreSQL 18 | 15432 | База данных с pgbench-нагрузкой |
| PGPRO OTEL Collector | 8888, 8889 | Сбор и экспорт телеметрии |
| VictoriaMetrics | 8428 | Хранение метрик |
| VictoriaLogs | 9428 | Хранение логов |
| Grafana | 3000 | Визуализация |

### Запуск окружения

```bash
docker compose up -d
```

### Проверка что всё запустилось

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Все контейнеры должны быть в статусе `Up`, PostgreSQL — `healthy`.

### Конфигурация PostgreSQL

PostgreSQL настроен для логирования в формате JSON. Ключевые параметры:

```
log_destination = 'jsonlog'       -- формат JSON для логов
logging_collector = on            -- включён сборщик логов
log_checkpoints = on              -- логируются контрольные точки
log_lock_waits = on               -- логируются ожидания блокировок
log_temp_files = 0                -- логируются все временные файлы
```

Логи пишутся в файл `/var/log/postgresql/postgresql.json`.

Пример записи в JSON-логе:

```json
{
  "timestamp": "2026-03-03 05:33:05.031 GMT",
  "user": "postgres",
  "dbname": "postgres",
  "pid": 59,
  "error_severity": "LOG",
  "message": "connection authorized: user=postgres database=postgres",
  "backend_type": "client backend",
  "query_id": 0
}
```

---

## 2. Настройка PGPRO OTEL Collector

### Структура конфигурации

Конфиг PGPRO OTEL Collector — это YAML-файл с четырьмя основными секциями:

```
receivers:      # Источники данных (откуда собираем)
processors:     # Обработка данных (преобразования, фильтрация, батчинг)
exporters:      # Назначения (куда отправляем)
service:        # Пайплайны (соединяют receivers → processors → exporters)
```

### Шаг 2.1. Конфигурация postgrespro receiver

Откройте файл `configs/otel-collector/config-step1.yaml`.

Секция `receivers.postgrespro` — это receiver для сбора метрик PostgreSQL. Рассмотрим ключевые параметры:

```yaml
receivers:
  postgrespro:
    transport: tcp                        # протокол подключения
    endpoint: postgres:5432               # адрес PostgreSQL
    database: postgres                    # база данных по умолчанию
    username: postgres
    password: ${env:POSTGRESQL_PASSWORD}  # пароль из переменной окружения
    collection_interval: 15s             # интервал сбора метрик
    max_threads: 3                        # потоки для параллельного сбора
```

**Плагины** определяют, какие метрики собирать. Каждый плагин отвечает за свою область:

| Плагин | Уровень | Что собирает |
|--------|---------|-------------|
| `activity` | instance | Соединения, vacuums, wait events |
| `archiver` | instance | Статистика архивации WAL |
| `bgwriter` | instance | Статистика background writer |
| `cache` | instance | Cache hit/miss ratio |
| `checkpointer` | instance | Статистика контрольных точек |
| `databases` | database | Транзакции, блоки, temp-файлы, конфликты |
| `health` | instance | Uptime и здоровье инстанса |
| `io` | instance | Статистика ввода-вывода |
| `locks` | instance | Блокировки |
| `replication` | instance | Репликация (для primary) |
| `tablespaces` | instance | Размеры табличных пространств |
| `version` | instance | Версия PostgreSQL |
| `wal` | instance | Статистика WAL |

### Шаг 2.2. Конфигурация hostmetrics receiver

В том же конфиге, секция `receivers.hostmetrics` собирает метрики операционной системы:

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

### Шаг 2.3. Конфигурация prometheus exporter

Для проверки сбора метрик используется prometheus exporter — он публикует все собранные метрики на HTTP-эндпоинте:

```yaml
exporters:
  prometheus:
    endpoint: :8889           # порт для публикации метрик
    send_timestamps: true     # включать метки времени
```

### Шаг 2.4. Пайплайн

Секция `service.pipelines` соединяет компоненты:

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

### Шаг 2.5. Применение конфига и проверка

Конфиг `config-step1.yaml` уже смонтирован в контейнер. Проверим что коллектор работает:

**1. Логи коллектора**

```bash
docker logs workshop-otel-collector 2>&1 | grep "Everything is ready"
```

Ожидаемый вывод:

```
"msg":"Everything is ready. Begin running and processing data."
```

**2. Метрики через prometheus exporter**

```bash
curl -s http://localhost:8889/metrics | grep "^postgresql_" | head -10
```

Ожидаемый вывод — метрики PostgreSQL в формате Prometheus:

```
postgresql_activity_connections{database="postgres",...,state="active"} 7
postgresql_activity_connections{database="postgres",...,state="idle"} 1
postgresql_bgwriter_buffers{type="allocated"} 12345
postgresql_cache_hit_ratio 0.998
...
```

**3. Подсчёт метрик**

```bash
curl -s http://localhost:8889/metrics | grep -c "^postgresql_"
```

Должно быть ~300+ метрик PostgreSQL.

**4. Метрики ОС**

```bash
curl -s http://localhost:8889/metrics | grep "^system_" | head -5
```

Ожидаемый вывод:

```
system_cpu_time{...} ...
system_memory_usage{...} ...
system_disk_io{...} ...
```

---

## 3. Интеграция с VictoriaMetrics

### Шаг 3.1. Добавление otlphttp exporter

Переключаемся на конфиг `config-step2.yaml`. Основное отличие — добавлен exporter для отправки метрик в VictoriaMetrics:

```yaml
exporters:
  # Prometheus exporter остаётся для проверки
  prometheus:
    endpoint: :8889
    send_timestamps: true

  # Новый: отправка метрик в VictoriaMetrics через OTLP
  otlphttp:
    endpoint: http://victoriametrics:8428/opentelemetry
    compression: gzip
    encoding: proto
```

И пайплайн обновлён — добавлен `otlphttp` в exporters:

```yaml
service:
  pipelines:
    metrics:
      receivers:
        - postgrespro
        - hostmetrics
      processors:
        - memory_limiter/metrics
        - batch/metrics
      exporters:
        - prometheus      # для проверки
        - otlphttp        # → VictoriaMetrics
```

### Шаг 3.2. Применение конфига

Отредактируйте `docker-compose.yml` — измените путь к конфигу коллектора:

```yaml
volumes:
  - ./configs/otel-collector/config-step2.yaml:/etc/pgpro-otel-collector/config.yaml:ro
```

Затем пересоздайте контейнер:

```bash
docker compose up -d otel-collector
```

### Шаг 3.3. Проверка

**1. Логи коллектора — убедимся что перезапуск прошёл успешно:**

```bash
docker logs workshop-otel-collector 2>&1 | grep "Everything is ready"
```

**2. Проверка метрик в VictoriaMetrics через VMUI:**

Откройте в браузере: http://localhost:8428/vmui

В строке запроса введите:

```
postgresql_health_uptime_milliseconds
```

Должен появиться график с uptime PostgreSQL.

**3. Проверка через API:**

```bash
# Список всех метрик
curl -s http://localhost:8428/api/v1/label/__name__/values | python3 -m json.tool | head -20

# Конкретная метрика
curl -s 'http://localhost:8428/api/v1/query?query=postgresql_activity_connections' | python3 -m json.tool
```

**4. Полезные запросы для проверки:**

> **Примечание:** Имена метрик при передаче через OTLP могут отличаться от Prometheus exporter —
> VictoriaMetrics добавляет суффиксы единиц измерения (`_milliseconds`, `_bytes`, `_total` и т.д.).

| Запрос | Что показывает |
|--------|---------------|
| `postgresql_health_uptime_milliseconds` | Время работы PostgreSQL |
| `postgresql_activity_connections` | Активные соединения |
| `rate(postgresql_databases_commits_unixtime_total[1m])` | Скорость коммитов |
| `postgresql_cache_hit_ratio_unixtime` | Cache hit ratio |
| `system_memory_usage_bytes` | Использование памяти |

---

## 4. Интеграция с VictoriaLogs

### Шаг 4.1. Добавление filelog receiver и VictoriaLogs exporter

Переключаемся на конфиг `config-step3.yaml` (финальный). Добавлены три компонента:

**Filelog receiver** — читает JSON-логи PostgreSQL:

```yaml
receivers:
  filelog:
    include:
      - /var/log/postgresql/*.json    # путь к JSON-логам PostgreSQL
    start_at: end                     # читать только новые записи
    operators:
      - type: json_parser             # парсинг JSON
        parse_ints: true
        timestamp:
          parse_from: attributes.timestamp
          layout_type: strptime
          layout: '%Y-%m-%d %H:%M:%S.%L %Z'
        severity:                      # маппинг severity PostgreSQL → OpenTelemetry
          parse_from: attributes.error_severity
          mapping:
            debug: [ DEBUG ]
            info:  [ INFO, NOTICE, LOG ]
            warn:  [ WARNING ]
            error: [ ERROR ]
            fatal: [ FATAL, PANIC ]
      - type: remove
        field: attributes.timestamp    # удаление дубликата после парсинга
```

**VictoriaLogs exporter** — отправляет логи:

```yaml
exporters:
  otlphttp/victorialogs:
    endpoint: http://victorialogs:9428/insert/opentelemetry
    compression: gzip
    encoding: proto
```

**Resource processor** — добавляет атрибуты для идентификации источника:

```yaml
processors:
  resource:
    attributes:
      - key: service.name
        action: upsert
        value: postgresql
      - key: service.instance.id
        action: upsert
        value: postgres:5432
```

### Шаг 4.2. Пайплайн логов

В `config-step3.yaml` появляется отдельный пайплайн для логов:

```yaml
service:
  pipelines:
    metrics:                    # пайплайн метрик (без изменений)
      receivers: [postgrespro, hostmetrics]
      processors: [memory_limiter/metrics, batch/metrics]
      exporters: [prometheus, otlphttp]

    logs:                       # новый пайплайн логов
      receivers: [filelog]
      processors: [resource, attributes/convert, batch/logs]
      exporters: [otlphttp/victorialogs]
```

### Шаг 4.3. Применение конфига

Отредактируйте `docker-compose.yml` — измените путь к конфигу коллектора:

```yaml
volumes:
  - ./configs/otel-collector/config-step3.yaml:/etc/pgpro-otel-collector/config.yaml:ro
```

Затем пересоздайте контейнер:

```bash
docker compose up -d otel-collector
```

### Шаг 4.4. Проверка

**1. Логи коллектора:**

```bash
docker logs workshop-otel-collector 2>&1 | grep "Everything is ready"
```

Убедитесь что строка `"Everything is ready."` присутствует.

**2. Проверка логов в VictoriaLogs через UI:**

Откройте в браузере: http://localhost:9428/select/vmui

В строке запроса введите:

```
*
```

Должны появиться логи PostgreSQL.

**3. Фильтрация логов:**

```
error_severity:ERROR
```

Покажет только ошибки.

```
_msg:"connection authorized"
```

Покажет логи авторизации.

**4. Live-режим — входящие логи в реальном времени:**

Откройте в браузере: http://localhost:9428/select/vmui

Переключитесь в режим **Live** (кнопка в верхней части интерфейса). В этом режиме новые логи отображаются по мере поступления — удобно для наблюдения за потоком в реальном времени.

Убедитесь, что логи продолжают поступать (pgbench генерирует нагрузку непрерывно).

**5. Проверка через API:**

```bash
curl -s 'http://localhost:9428/select/logsql/query?query=*&limit=5' 2>&1 | head -20
```

---

## 5. Визуализация в Grafana

Откройте Grafana: http://localhost:3000

Логин: `admin` / Пароль: `workshop`

### Шаг 5.1. Datasources

Datasources уже настроены через provisioning:

- **VictoriaMetrics** — тип Prometheus, URL `http://victoriametrics:8428`
- **VictoriaLogs** — тип VictoriaLogs Datasource, URL `http://victorialogs:9428`

Проверьте в меню: **Connections → Data sources**. Должны быть два источника.

### Шаг 5.2. Дашборд метрик PostgreSQL

Дашборд **"PostgreSQL Workshop"** уже импортирован через provisioning.

Перейдите в **Dashboards → PostgreSQL Workshop**.

На дашборде:

| Панель | Метрика | Что показывает |
|--------|---------|---------------|
| PostgreSQL Uptime | `postgresql_health_uptime_milliseconds` | Время работы |
| Active Connections | `postgresql_activity_connections` | Соединения по состояниям |
| Transactions | `rate(postgresql_databases_commits_unixtime_total[1m])` | Скорость транзакций |
| Cache Hit Ratio | `postgresql_cache_hit_ratio_unixtime` | Эффективность кэша |
| WAL Generation | `rate(postgresql_wal_bytes_total[1m])` | Скорость генерации WAL |
| Locks | `postgresql_locks_all_milliseconds` | Блокировки по типам |
| CPU Usage | `rate(system_cpu_time_seconds_total[1m])` | Использование CPU |
| Memory Usage | `system_memory_usage_bytes` | Использование памяти |

Благодаря pgbench-нагрузке, графики показывают реальную активность.

### Шаг 5.3. Просмотр логов

Перейдите в **Explore** (иконка компаса в боковом меню).

1. В верхнем выпадающем списке выберите datasource **VictoriaLogs**
2. В строке запроса введите `*` и нажмите **Run query**
3. Появятся логи PostgreSQL

Полезные запросы для логов:

| Запрос | Что показывает |
|--------|---------------|
| `*` | Все логи |
| `error_severity:ERROR` | Только ошибки |
| `error_severity:WARNING` | Предупреждения |
| `_msg:"checkpoint"` | Логи контрольных точек |
| `_msg:"connection"` | Логи подключений |
| `_msg:"lock"` | Логи блокировок |

### Шаг 5.4. Создание панели для логов

Сначала сгенерируем ошибки в PostgreSQL, чтобы на панели гарантированно появились данные:

```bash
docker exec workshop-postgres psql -U postgres -c "SELECT * FROM nonexistent_table;"
```

Команда завершится с ошибкой — это нормально. Ошибка запишется в JSON-лог, коллектор отправит её в VictoriaLogs.

Теперь создадим панель:

1. Откройте дашборд **PostgreSQL Workshop**
2. Нажмите **Add → Visualization**
3. Выберите datasource **VictoriaLogs**
4. В редакторе запроса переключите **Query type** на **Logs**
5. Запрос: `error_severity:ERROR OR error_severity:WARNING`
6. Тип визуализации (правая панель) — **Logs**
7. Заголовок панели: **PostgreSQL Errors & Warnings**
8. Сохраните панель

> **Примечание:** Данные появятся с небольшой задержкой (до 30 секунд) — коллектор отправляет логи пачками (batch processor).

Теперь на дашборде есть и метрики, и логи PostgreSQL в одном месте.

---

## 6. Траблшутинг

### Коллектор не стартует

**Симптом:** Контейнер `workshop-otel-collector` постоянно перезапускается.

**Диагностика:**

```bash
docker logs workshop-otel-collector 2>&1 | grep -i error
```

**Частые причины:**

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `connection refused` к PostgreSQL | PostgreSQL не готов | Проверить `docker ps`, подождать healthcheck |
| `invalid configuration` | Ошибка в YAML | Проверить отступы, `:` после ключей |
| `unknown component` | Неизвестный receiver/exporter | Проверить имена компонентов |
| `address already in use` | Порт занят | Проверить что нет другого процесса на порту |

### Метрики не появляются в VictoriaMetrics

**Диагностика:**

```bash
# 1. Проверить что коллектор собирает метрики
curl -s http://localhost:8889/metrics | grep -c "^postgresql_"

# 2. Проверить логи коллектора на ошибки экспорта
docker logs workshop-otel-collector 2>&1 | grep -i "error\|failed\|refused"

# 3. Проверить что VictoriaMetrics доступен
curl -s http://localhost:8428/health
```

**Частые причины:**

- Конфиг не содержит `otlphttp` exporter (используется step1 вместо step2)
- Неверный `endpoint` в otlphttp exporter
- VictoriaMetrics не запущен

### Логи не появляются в VictoriaLogs

**Диагностика:**

```bash
# 1. Проверить что JSON-логи PostgreSQL существуют
docker exec workshop-postgres ls -la /var/log/postgresql/

# 2. Проверить что коллектор видит файл логов
docker logs workshop-otel-collector 2>&1 | grep -i "filelog\|log"

# 3. Проверить что VictoriaLogs доступен
curl -s http://localhost:9428/health
```

**Частые причины:**

- Конфиг не содержит `filelog` receiver (используется step1/step2 вместо step3)
- Путь в `include` не совпадает с реальным путём к логам
- Volume с логами не смонтирован в контейнер коллектора

### Grafana не показывает данные

**Диагностика:**

```bash
# 1. Проверить datasources
curl -s -u admin:workshop http://localhost:3000/api/datasources | python3 -m json.tool

# 2. Проверить что метрики есть в VictoriaMetrics
curl -s 'http://localhost:8428/api/v1/query?query=up'
```

**Частые причины:**

- Datasource URL указывает на `localhost` вместо имени контейнера
- VictoriaLogs плагин не установлен (проверить логи Grafana)
- Метрики ещё не накопились (подождать 1-2 минуты)

### Полный перезапуск окружения

Если ничего не помогает — полный сброс:

```bash
docker compose down -v
docker compose up -d
```

> **Внимание:** `-v` удаляет все данные (метрики, логи, дашборды). Используйте только как крайнюю меру.
