FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends lame sox curl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "bot.js"]
