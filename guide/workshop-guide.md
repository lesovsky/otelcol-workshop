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

**Задача:** убедиться, что на вашей рабочей станции установлены все необходимые инструменты.

**Обязательные:**

| Инструмент | Минимальная версия | Проверка |
|------------|-------------------|----------|
| Docker Engine | 24.0+ | `docker --version` |
| Docker Compose | 2.20+ (плагин V2) | `docker compose version` |
| curl | любая | `curl --version` |
| git | любая | `git --version` |

**Рекомендуемые:**

- **Текстовый редактор** — для просмотра и редактирования YAML-конфигов (VS Code, vim, nano и т.д.)
- **Веб-браузер** — для работы с Grafana, VMUI, VictoriaLogs UI

### Установка Docker (если не установлен)

**Задача:** установить Docker, если он ещё не установлен на вашей машине.

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

### Проверка готовности

**Задача:** выполнить команды и убедиться, что все инструменты установлены и работают.

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

> **Если вы уже работаете в этом приложении** — значит, репозиторий у вас уже склонирован и окружение запущено. Этот шаг можно пропустить.

**Задача:** склонировать репозиторий с материалами воркшопа и подготовить Docker-образы.

```bash
git clone https://github.com/lesovsky/otelcol-workshop.git
cd otelcol-workshop
```

> **Важно:** Первый запуск загрузит Docker-образы (~2 ГБ). Рекомендуется скачать их **заранее**, чтобы не зависеть от интернета на площадке.
>
> Если загрузка образов завершается ошибкой `Too Many Requests`, выполните `docker login` — Docker Hub ограничивает количество загрузок для анонимных пользователей.
>
> ```bash
> docker pull postgres:18
> docker pull victoriametrics/victoria-metrics:v1.137.0
> docker pull victoriametrics/victoria-logs:v1.47.0
> docker pull grafana/grafana:12.4.0
> docker pull debian:trixie-slim
> ```
>
> Образ PGPRO OTEL Collector будет собран локально на воркшопе из Dockerfile.
>
> **macOS на Apple Silicon (M1/M2/M3):** Если сборка образа коллектора завершается ошибкой, замените в `dockerfiles/otel-collector/Dockerfile` первую строку и имя пакета:
> ```dockerfile
> FROM --platform=linux/arm64 debian:trixie-slim
> ...
> ARG OTELCOL_PKG=pgpro-otel-collector_${OTELCOL_VERSION}.bookworm_arm64.deb
> ```

---

## 1. Подготовка окружения

**Задача:** запустить все контейнеры окружения и убедиться, что они работают.

Запустите окружение:

```bash
docker compose up -d
```

Проверьте, что все контейнеры запустились:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Все контейнеры должны быть в статусе `Up`, PostgreSQL — `healthy`.

### Конфигурация PostgreSQL

> **Информация:** для воркшопа потребовались дополнительные настройки PostgreSQL. Они уже применены в конфигурации — вам ничего не нужно менять. Ниже описано, что именно настроено и зачем.

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

Конфиг PGPRO OTEL Collector — это YAML-файл с четырьмя основными секциями:

```
receivers:      # Источники данных (откуда собираем)
processors:     # Обработка данных (преобразования, фильтрация, батчинг)
exporters:      # Назначения (куда отправляем)
service:        # Пайплайны (соединяют receivers → processors → exporters)
```

### Конфигурация postgrespro receiver

**Задача:** изучить параметры подключения к PostgreSQL и список плагинов для сбора метрик.

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
| `health` | instance | Uptime и время запуска инстанса |
| `io` | instance | Статистика ввода-вывода |
| `locks` | instance | Блокировки |
| `replication` | instance | Репликация (для primary) |
| `tablespaces` | instance | Размеры табличных пространств |
| `version` | instance | Версия PostgreSQL |
| `wal` | instance | Статистика WAL |

### Конфигурация hostmetrics receiver

**Задача:** изучить настройки сбора метрик операционной системы.

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

### Конфигурация prometheus exporter

**Задача:** изучить настройки публикации метрик для проверки.

Для проверки сбора метрик используется prometheus exporter — он публикует все собранные метрики на HTTP-эндпоинте:

```yaml
exporters:
  prometheus:
    endpoint: :8889           # порт для публикации метрик
    send_timestamps: true     # включать метки времени
```

### Пайплайн

**Задача:** понять, как receivers, processors и exporters объединяются в pipeline.

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
      exporters:
        - prometheus        # публикация для проверки
```

### Применение конфига и проверка

**Задача:** убедиться, что коллектор работает и метрики собираются.

Конфиг `config-step1.yaml` уже смонтирован в контейнер при запуске. Перезапускать контейнеры не нужно — достаточно убедиться, что всё работает:

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

### Итоги

В этом разделе мы настроили PGPRO OTEL Collector и убедились, что метрики собираются:

- **postgrespro receiver** собирает ~300+ метрик PostgreSQL по плагинам (activity, wal, locks, cache и др.)
- **hostmetrics receiver** собирает метрики ОС (CPU, память, диск, сеть)
- **prometheus exporter** публикует метрики для проверки на `http://localhost:8889/metrics`
- Конфигурация построена по схеме: receivers → processors → exporters → service

Следующий шаг — отправка метрик в хранилище VictoriaMetrics.

---

## 3. Интеграция с VictoriaMetrics

**Задача:** изучить изменения в `config-step2.yaml`, переключить коллектор на новый конфиг и пересоздать контейнер.

Переключаемся на конфиг `config-step2.yaml`. Основное отличие — добавлен exporter для отправки метрик в VictoriaMetrics и transform processor для исправления имён метрик:

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

```yaml
processors:
  transform:
    metric_statements:
      - context: metric
        statements:
          - set(unit, "1") where unit == ""
```

Обновлённый пайплайн:

```yaml
service:
  pipelines:
    metrics:
      receivers:
        - postgrespro
        - hostmetrics
      processors:
        - memory_limiter/metrics
        - transform
        - batch/metrics
      exporters:
        - prometheus      # для проверки
        - otlphttp        # → VictoriaMetrics
```

Отредактируйте `docker-compose.yml` — измените путь к конфигу коллектора:

```yaml
volumes:
  - ./configs/otel-collector/config-step2.yaml:/etc/pgpro-otel-collector/config.yaml:ro
```

Затем пересоздайте контейнер:

```bash
docker compose up -d otel-collector
```

### Проверка

**Задача:** убедиться, что метрики поступают в VictoriaMetrics и доступны для запросов.

**1. Логи коллектора — убедимся что перезапуск прошёл успешно:**

```bash
docker logs workshop-otel-collector 2>&1 | grep "Everything is ready"
```

**2. Проверка метрик в VictoriaMetrics через VMUI:**

Откройте в браузере: `http://localhost:8428/vmui`

В строке запроса введите:

```
postgresql_health_uptime_milliseconds
```

Должен появиться график с uptime PostgreSQL.

**3. Проверка через API:**

```bash
curl -s 'http://localhost:8428/api/v1/query?query=postgresql_activity_connections' | python3 -m json.tool
```

**4. Полезные запросы для проверки:**

> **Примечание:** Имена метрик при передаче через OTLP отличаются от Prometheus exporter — VictoriaMetrics добавляет суффиксы единиц измерения (`_milliseconds`, `_bytes`, `_total` и т.д.).

| Запрос | Что показывает |
|--------|---------------|
| `postgresql_health_uptime_milliseconds` | Время работы PostgreSQL — базовая проверка что метрики поступают |
| `postgresql_activity_connections` | Текущие соединения по состояниям — видна активность pgbench |
| `rate(postgresql_databases_commits_total[1m])` | Скорость коммитов в секунду — основной показатель нагрузки |
| `postgresql_cache_hit_ratio` | Эффективность кэша shared_buffers — должна быть > 0.9 |
| `system_memory_usage_bytes` | Использование памяти ОС по категориям (used, cached, free) |

### Итоги

В этом разделе мы настроили отправку метрик из коллектора в VictoriaMetrics:

- **otlphttp exporter** отправляет метрики напрямую по протоколу OTLP
- **Transform processor** исправляет пустой unit, предотвращая искажение имён метрик
- **VictoriaMetrics** хранит метрики и предоставляет их через PromQL/MetricsQL и VMUI
- Prometheus exporter остаётся для локальной проверки и сравнения имён

Следующий шаг — настройка сбора логов и отправка в VictoriaLogs.

---

## 4. Интеграция с VictoriaLogs

**Задача:** изучить изменения в `config-step3.yaml`, переключить коллектор на финальный конфиг и убедиться, что логи поступают в VictoriaLogs.

Переключаемся на конфиг `config-step3.yaml` (финальный). Добавлены три новых компонента: filelog receiver для чтения JSON-логов PostgreSQL, otlphttp/victorialogs exporter для отправки логов и resource processor для идентификации источника. Пайплайн метрик остаётся без изменений.

Отредактируйте `docker-compose.yml` — измените путь к конфигу коллектора:

```yaml
volumes:
  - ./configs/otel-collector/config-step3.yaml:/etc/pgpro-otel-collector/config.yaml:ro
```

Затем пересоздайте контейнер:

```bash
docker compose up -d otel-collector
```

### Проверка

**Задача:** убедиться, что логи PostgreSQL поступают в VictoriaLogs и доступны для поиска.

**1. Логи коллектора:**

```bash
docker logs workshop-otel-collector 2>&1 | grep "Everything is ready"
```

Убедитесь что строка `"Everything is ready."` присутствует.

**2. Проверка логов в VictoriaLogs через UI:**

Откройте в браузере: `http://localhost:9428/select/vmui`

В строке запроса введите `*` — должны появиться логи PostgreSQL.

Полезные запросы для фильтрации:

| Запрос | Что покажет |
|--------|------------|
| `*` | Все логи |
| `error_severity:ERROR` | Только ошибки |
| `error_severity:WARNING` | Предупреждения |
| `_msg:"checkpoint"` | Логи контрольных точек |
| `_msg:"connection"` | Логи подключений |

**3. Live-режим:**

В VictoriaLogs UI переключитесь в режим **Live** (кнопка в верхней части интерфейса). Новые логи отображаются по мере поступления — убедитесь, что поток непрерывный (pgbench генерирует нагрузку).

**4. Проверка через API:**

```bash
curl -s 'http://localhost:9428/select/logsql/query?query=*&limit=5' 2>&1 | head -20
```

### Итоги

В этом разделе мы настроили сбор логов PostgreSQL и их отправку в VictoriaLogs:

- **filelog receiver** читает JSON-логи, парсит timestamp и severity
- **resource processor** добавляет идентификацию источника (service.name, service.instance.id)
- **VictoriaLogs** хранит логи и предоставляет поиск через LogsQL и встроенный UI
- Финальный конфиг: метрики + логи в одном коллекторе, два независимых пайплайна

Следующий шаг — визуализация в Grafana.

---

## 5. Визуализация в Grafana

**Задача:** открыть Grafana, проверить datasources, изучить дашборд с метриками и настроить просмотр логов.

Откройте Grafana: `http://localhost:3000` | Логин: `admin` / Пароль: `workshop`

### Datasources

**Задача:** убедиться, что оба источника данных подключены и работают.

Datasources настроены автоматически через provisioning — ручная настройка не требуется.

Проверьте в меню: **Connections → Data sources**. Должны быть два источника:

- **VictoriaMetrics** — тип Prometheus, URL `http://victoriametrics:8428`
- **VictoriaLogs** — тип VictoriaLogs Datasource, URL `http://victorialogs:9428`

### Дашборд метрик

**Задача:** открыть дашборд PostgreSQL Workshop и убедиться, что графики показывают реальную активность.

Перейдите в **Dashboards → PostgreSQL Workshop**. Дашборд импортирован через provisioning и содержит панели с основными метриками. Благодаря pgbench-нагрузке, графики показывают реальную активность.

### Просмотр логов в Explore

**Задача:** открыть Explore, выбрать VictoriaLogs и выполнить запросы для поиска по логам.

Перейдите в **Explore** (иконка компаса в боковом меню).

1. В верхнем выпадающем списке выберите datasource **VictoriaLogs**
2. В строке запроса введите `*` и нажмите **Run query**
3. Появятся логи PostgreSQL

Полезные запросы:

| Запрос | Что показывает |
|--------|---------------|
| `*` | Все логи |
| `error_severity:ERROR` | Только ошибки |
| `error_severity:WARNING` | Предупреждения |
| `_msg:"checkpoint"` | Логи контрольных точек |
| `_msg:"connection"` | Логи подключений |

### Создание панели для логов

**Задача:** добавить панель с логами ошибок на дашборд, чтобы метрики и логи были на одном экране.

Сначала сгенерируем ошибки в PostgreSQL:

```bash
docker exec workshop-postgres psql -U postgres -c "SELECT * FROM nonexistent_table;"
```

Команда завершится с ошибкой — это нормально. Ошибка запишется в JSON-лог и попадёт в VictoriaLogs.

Теперь создадим панель:

1. Откройте дашборд **PostgreSQL Workshop**
2. Нажмите **Add → Visualization**
3. Выберите datasource **VictoriaLogs**
4. В редакторе запроса переключите **Query type** на **Raw Logs**
5. Запрос: `error_severity:ERROR OR error_severity:WARNING`
6. Тип визуализации (правая панель) — **Logs**
7. Заголовок панели: **PostgreSQL Errors & Warnings**
8. Сохраните панель

> **Примечание:** Данные появятся с небольшой задержкой (до 30 секунд) — коллектор отправляет логи пачками (batch processor).

### Итоги

Полный pipeline мониторинга PostgreSQL настроен и работает:

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

- **Grafana** объединяет метрики и логи в одном интерфейсе
- Дашборд с метриками PostgreSQL и ОС показывает реальную активность
- Explore позволяет искать по логам через LogsQL
- Метрики и логи на одном дашборде — полная картина состояния СУБД

---

## 6. Траблшутинг

Типичные проблемы и способы их решения:

- **Коллектор не стартует** — контейнер перезапускается, ошибки конфигурации
- **Метрики не появляются в VictoriaMetrics** — проблемы с exporter или подключением
- **Логи не появляются в VictoriaLogs** — проблемы с filelog receiver или volumes
- **Grafana не показывает данные** — проблемы с datasources или плагинами
- **Полный перезапуск окружения** — крайняя мера при неразрешимых проблемах

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
