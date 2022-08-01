FROM node:alpine as build-env

ARG TARGETPLATFORM
ENV TARGETPLATFORM=${TARGETPLATFORM:-linux/amd64}
WORKDIR /app
COPY . .
RUN npm install && npm audit fix
CMD [ "npm", "run", "build-and-start" ]
EXPOSE 8080 3306