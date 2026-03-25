---
marp: true
theme: default
paginate: true
---

# Итоги и что дальше

---

## Что мы сделали на воркшопе

- Развернули полный pipeline мониторинга PostgreSQL
- Настроили сбор метрик (postgrespro, hostmetrics)
- Настроили сбор JSON-логов (filelog)
- Отправили метрики в VictoriaMetrics через OTLP
- Отправили логи в VictoriaLogs через OTLP
- Построили дашборды и Explore в Grafana

---

## Что ещё умеет PGPRO OTEL Collector

Мы рассмотрели лишь часть возможностей.

---

## Дополнительные receivers

| Receiver | Что делает |
|----------|-----------|
| `journald` | Логи из systemd journal |
| `sqlquery` | Кастомные SQL-запросы |

---

## Дополнительные processors

| Processor | Что делает |
|-----------|-----------|
| `filter` | Фильтрация данных (drop/include) |
| `transform` | Трансформация (OTTL-выражения) |
| `metricstransform` | Переименование, агрегация метрик |

---

## Дополнительные exporters

| Exporter | Куда отправляет |
|----------|----------------|
| `kafka` | Apache Kafka |
| `zabbix` | Zabbix |

---

## Плагины метрик — не рассмотренные

| Плагин | Что собирает |
|--------|-------------|
| `statements` | pg_stat_statements |
| `indexes` | Использование индексов |
| `tables` | Статистика таблиц |
| `bloat` | Раздувание таблиц и индексов |
| `buffercache` | Содержимое shared buffers |
| `functions` | Статистика функций |

---

## Плагины метрик — продвинутые

| Плагин | Что собирает |
|--------|-------------|
| `replication_slots` | Слоты репликации |
| `subscriptions` | Логическая репликация |
| `prepared_transactions` | Двухфазные транзакции |
| `sequences` | Использование последовательностей |
| `recovery` | Статистика восстановления |
| `biha` | Встроенная высокая доступность |

---

## Безопасность и ACL

- **TLS** — шифрование соединений
- **Basic Auth** — аутентификация через htpasswd
- **ACL-списки** — фильтрация объектов мониторинга

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

- **PPEM** — централизованное управление Postgres Pro
- **Zabbix** — интеграция с существующим мониторингом
- **Kafka** — потоковая обработка телеметрии

---

## Полезные ссылки

- [postgrespro.ru/docs/otelcol](https://postgrespro.ru/docs/otelcol)
- [docs.victoriametrics.com](https://docs.victoriametrics.com)
- [docs.victoriametrics.com/victorialogs](https://docs.victoriametrics.com/victorialogs)
- [opentelemetry.io](https://opentelemetry.io)

---

## Спасибо!

Вопросы?

---
