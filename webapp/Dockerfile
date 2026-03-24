FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./
COPY public/ ./public/

# Content (slides/, guide/) mounted at /data/content via volumes
VOLUME /data/content

EXPOSE 8080

CMD ["node", "server.js"]
