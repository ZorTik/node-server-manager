FROM node:18

WORKDIR /data

COPY . .

RUN npm install

ARG dbbaseurl="mysql://test:test@localhost:3306"
ARG dockerhost="tcp://docker:2375"

ENV DATABASE_URL="${dbbaseurl}/test"
ENV SHADOW_DATABASE_URL="${dbbaseurl}/testshadow"
ENV CONFIG_DOCKER_HOST=""

RUN npx prisma generate
RUN npx prisma migrate dev --name init
RUN npm run build

CMD ["npm", "run", "start"]