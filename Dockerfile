FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build && chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
