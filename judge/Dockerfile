FROM node:22-alpine

# docker CLI only — the daemon is the host's, reached via the mounted socket.
RUN apk add --no-cache docker-cli

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
