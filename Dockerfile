FROM --platform=${BUILDPLATFORM} node as build-env
ARG TARGETARCH
ENV BUILDX_ARCH="${TARGETOS:-linux}-${TARGETARCH}"

WORKDIR /app

COPY . .

RUN npm install && npm audit fix

CMD [ "npm", "run", "build-and-start" ]
EXPOSE 8080 3306
