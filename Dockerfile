FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5179
ENV PROJECTS_STATE_FILE=/app/state/state.json

COPY server/package*.json ./server/
RUN npm --prefix server ci

COPY index.html ./
COPY assets ./assets
COPY data ./data
COPY server/server.js ./server/server.js

RUN ./server/node_modules/.bin/terser assets/demo.js \
    --compress --mangle --comments false --output assets/demo.js \
  && npm --prefix server prune --omit=dev

RUN mkdir -p /app/state \
  && addgroup -S app \
  && adduser -S app -G app \
  && chown -R app:app /app/state

USER app

EXPOSE 5179

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '5179') + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/server.js"]
