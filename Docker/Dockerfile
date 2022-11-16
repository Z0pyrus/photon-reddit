FROM --platform=${BUILDPLATFORM} node:14 as build-env

ARG TARGETPLATFORM
ENV TARGETPLATFORM=${TARGETPLATFORM:-linux/amd64}

WORKDIR /app

COPY . .

RUN apt-get update || : && apt-get install python -y

RUN npm install && npm audit fix

CMD [ "npm", "run", "build-and-start" ]

EXPOSE 8080 3306
