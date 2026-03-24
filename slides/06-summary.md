---
marp: true
theme: default
paginate: true
---

# Итоги и что дальше

---

## Что мы сделали на воркшопе

- Развернули полный pipeline мониторинга PostgreSQL
- Настроили сбор метрик (**postgrespro**, **hostmetrics**)
- Настроили сбор логов (**filelog**)
- Отправили метрики в **VictoriaMetrics** через OTLP
- Отправили логи в **VictoriaLogs** через OTLP
- Построили дашборды и Explore в **Grafana**

---

## Что ещё умеет PGPRO OTEL Collector

Мы рассмотрели лишь часть возможностей. Вот что осталось за рамками воркшопа.

---

## Дополнительные receivers

| Receiver | Что делает |
|----------|-----------|
| `journald` | Чтение логов из systemd journal |
| `sqlquery` | Кастомные SQL-запросы для сбора метрик и логов |

`sqlquery` позволяет собирать **любые** данные из PostgreSQL — достаточно написать SQL-запрос.

---

## Дополнительные processors

| Processor | Что делает |
|-----------|-----------|
| `filter` | Фильтрация данных по условиям (drop/include) |
| `transform` | Трансформация телеметрии (OTTL-выражения) |
| `metricstransform` | Переименование, агрегация, масштабирование метрик |

Полезно для продакшена: убрать лишние метрики, переименовать, агрегировать.

---

## Дополнительные exporters

| Exporter | Куда отправляет |
|----------|----------------|
| `kafka` | Apache Kafka (для сложных pipeline) |
| `zabbix` | Zabbix (интеграция с существующим мониторингом) |

Можно комбинировать: одни данные в VictoriaMetrics, другие — в Kafka или Zabbix.

---

## Плагины метрик — не рассмотренные

| Плагин | Что собирает |
|--------|-------------|
| `statements` | pg_stat_statements — статистика запросов |
| `indexes` | Использование индексов |
| `tables` | Статистика таблиц (seq scan, idx scan, live/dead tuples) |
| `bloat` | Раздувание таблиц и индексов |
| `buffercache` | pg_buffercache — содержимое shared buffers |
| `functions` | Статистика пользовательских функций |

---

## Плагины метрик — продвинутые

| Плагин | Что собирает |
|--------|-------------|
| `replication_slots` | Слоты репликации |
| `subscriptions` | Логическая репликация (подписки) |
| `prepared_transactions` | Подготовленные (двухфазные) транзакции |
| `sequences` | Использование последовательностей |
| `recovery` | Статистика восстановления |
| `biha` | BiHA — встроенная высокая доступность |

---

## Безопасность и ACL

- **TLS** — шифрование соединений с хранилищами (ca_file, cert_file, key_file)
- **Basic Auth** — аутентификация через htpasswd
- **ACL-списки** — фильтрация объектов мониторинга:
  - По базам данных, схемам, таблицам, индексам, функциям
  - Поддержка регулярных выражений

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

- **PPEM** (Postgres Pro Enterprise Manager) — централизованное управление
- **Zabbix** — экспорт метрик в существующую инфраструктуру мониторинга
- **Kafka** — потоковая обработка телеметрии

---

## Полезные ссылки

- Документация PGPRO OTEL Collector:
  `postgrespro.ru/docs/otelcol`
- VictoriaMetrics:
  `docs.victoriametrics.com`
- VictoriaLogs:
  `docs.victoriametrics.com/victorialogs`
- OpenTelemetry:
  `opentelemetry.io`

---

## Спасибо!

Вопросы?

---
