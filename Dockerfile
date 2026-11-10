FROM node:24-alpine

WORKDIR /app

# Copy package manifests first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source and build the frontend SPA
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY server ./server
RUN npm run build

# Ensure persistent SQLite directory exists
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8001
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/chores.db

EXPOSE 8001

CMD ["npm", "start"]
