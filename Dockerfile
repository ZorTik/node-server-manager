FROM node:18

WORKDIR /data

COPY . .

RUN npm install
RUN npm install -g prisma

ARG dbbaseurl="mysql://root:root@mariadb:3306"
ARG dockerhost="tcp://docker:2375"

ENV DATABASE_URL="${dbbaseurl}/nsm"
ENV SHADOW_DATABASE_URL="${dbbaseurl}/nsmshadow"
ENV CONFIG_DOCKER_HOST=""

RUN npx prisma generate
RUN npm run build

CMD npx prisma migrate dev --name init && npm run start