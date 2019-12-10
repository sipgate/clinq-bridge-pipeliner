FROM node:lts-alpine AS builder
RUN apk add --no-cache yarn
WORKDIR /usr/src/app
COPY package*.json yarn.lock ./
RUN yarn
COPY . .
RUN yarn build

FROM node:lts-alpine
RUN apk add --no-cache yarn
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY package*.json yarn.lock ./
RUN yarn --production
COPY --from=builder /usr/src/app/dist/ dist/
USER node
EXPOSE 8080
ENTRYPOINT node dist/index.js
