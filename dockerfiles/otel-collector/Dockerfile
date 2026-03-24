FROM debian:trixie-slim

ARG OTELCOL_VERSION=0.5.0-1
ARG OTELCOL_PKG=pgpro-otel-collector_${OTELCOL_VERSION}.trixie_amd64.deb
ARG OTELCOL_URL=https://repo.postgrespro.ru/otelcol/otelcol/debian/pool/main/o/otelcol/${OTELCOL_PKG}

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    curl -fsSL --retry 3 --retry-delay 5 -o /tmp/${OTELCOL_PKG} ${OTELCOL_URL} && \
    dpkg -i /tmp/${OTELCOL_PKG} || apt-get install -y -f --no-install-recommends && \
    pgpro-otel-collector --version && \
    rm -f /tmp/${OTELCOL_PKG} && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 8888 8889

ENTRYPOINT ["pgpro-otel-collector"]
CMD ["--config", "/etc/pgpro-otel-collector/config.yaml"]
