#Edit "amd64" to your platform or pass an environment variable with your platform
FROM node:alpine

ARG TARGETPLATFORM
ENV TARGETPLATFORM=${TARGETPLATFORM:-linux/amd64}

FROM --platform=linux/amd64 node:alpine as stage-amd
FROM --platform=linux/arm64 node:alpine as stage-arm64
FROM --platform=linux/arm node:alpine as stage-arm

ARG TARGETARCH
FROM stage-${TARGETARCH} as final

WORKDIR /app

COPY . .

RUN npm install && npm audit fix

CMD [ "npm", "run", "build-and-start" ]

EXPOSE 8080 3306
