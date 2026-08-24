# Independent production image for the team workspace.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
RUN npm ci --include=dev
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 4200
CMD ["./node_modules/.bin/vinext", "start", "--port", "4200", "--hostname", "0.0.0.0"]
