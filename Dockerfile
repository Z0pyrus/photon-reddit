FROM --platform=${BUILDPLATFORM} node as build-env

ARG TARGETARCH
ENV BUILDX_ARCH="${TARGETOS:-linux}-${TARGETARCH}"

WORKDIR /app

COPY . .

FROM --platform=linux/arm arm32v7/node as stage-arm32v7
RUN npm install && npm audit fix

FROM --platform=linux/arm64 arm64/node as stage-arm64
RUN npm install && npm audit fix

FROM --platform=linux/amd64 node as stage-amd64
RUN npm install && npm audit fix

ARG TARGETARCH
FROM stage-${TARGETARCH} as final

CMD [ "npm", "run", "build-and-start" ]
EXPOSE 8080 3306
