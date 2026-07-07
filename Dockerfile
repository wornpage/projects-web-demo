FROM node:24-alpine AS build

WORKDIR /app

ENV NODE_ENV=production

COPY server/package*.json ./server/
RUN npm --prefix server ci --include=dev
RUN mkdir -p assets data scripts src/demo

COPY index.html ./
COPY landing.html ./
COPY assets/demo.css ./assets/demo.css
COPY assets/demo.js ./assets/demo.js
COPY assets/landing.css ./assets/landing.css
COPY assets/favicon.png ./assets/favicon.png
COPY data/demo-packs.json ./data/demo-packs.json
COPY src/demo/demo.js ./src/demo/demo.js
COPY src/demo/telemetry.js ./src/demo/telemetry.js
COPY scripts/build-demo-asset.mjs ./scripts/build-demo-asset.mjs
COPY scripts/protect-frontend.mjs ./scripts/protect-frontend.mjs
COPY server/server.js ./server/server.js
COPY server/src ./server/src

RUN node scripts/build-demo-asset.mjs --check \
  && node scripts/protect-frontend.mjs assets/demo.js assets/demo.js \
  && npm --prefix server prune --omit=dev

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5179
ENV PROJECTS_STATE_FILE=/app/state/state.json

COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/index.html ./
COPY --from=build /app/landing.html ./
COPY --from=build /app/assets/demo.css ./assets/demo.css
COPY --from=build /app/assets/demo.js ./assets/demo.js
COPY --from=build /app/assets/landing.css ./assets/landing.css
COPY --from=build /app/assets/favicon.png ./assets/favicon.png
COPY --from=build /app/data/demo-packs.json ./data/demo-packs.json
COPY --from=build /app/server/server.js ./server/server.js
COPY --from=build /app/server/src ./server/src

RUN mkdir -p /app/state \
  && addgroup -S app \
  && adduser -S app -G app \
  && chown -R app:app /app/state

USER app

EXPOSE 5179

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '5179') + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/server.js"]
