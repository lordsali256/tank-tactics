FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production TANK_BIND_HOST=0.0.0.0 TANK_DATA_DIR=/data
COPY package.json ./
COPY local ./local
COPY cloud/python-policy.mjs ./cloud/python-policy.mjs
COPY docs/SQUADSCRIPT.md ./docs/SQUADSCRIPT.md
COPY drizzle ./drizzle
COPY dist ./dist
USER node
EXPOSE 8878
CMD ["node", "local/bridge.mjs"]
