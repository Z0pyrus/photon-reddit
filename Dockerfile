FROM ${BUILDARCH}/node as build-env

ARG TARGETPLATFORM
ENV BUILDX_ARCH="${TARGETOS:-linux}-${TARGETARCH}"
WORKDIR /app
COPY . .
RUN npm install && npm audit fix
CMD [ "npm", "run", "build-and-start" ]
EXPOSE 8080 3306
