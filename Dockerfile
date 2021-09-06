FROM node:lts-alpine AS build

COPY package.json yarn.lock tsconfig.json /build/
COPY src /build/src

WORKDIR /build

RUN yarn install
RUN yarn build

FROM node:lts-alpine

COPY --from=build /build/package.json /build/yarn.lock /build/tsconfig.json /app/
COPY --from=build /build/dist /app/dist

WORKDIR /app

ENV NODE_ENV=production

RUN yarn install

ENTRYPOINT node dist/index.js
