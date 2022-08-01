#Edit "amd64" to your platform or pass an environment variable with your platform
FROM --platform=${BUILDPLATFORM:-amd64} node:alpine as build-env

ARG TARGETPLATFORM
ENV TARGETPLATFORM=${TARGETPLATFORM:-linux/amd64}

WORKDIR /app

COPY . .

RUN npm install && npm audit fix

CMD [ "npm", "run", "build-and-start" ]

EXPOSE 8080 3306
