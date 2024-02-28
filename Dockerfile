FROM node:18

WORKDIR /app

COPY . .

ENV DATABASE_URL="mysql://test:test@localhost:3306/test"
ENV CONFIG_NODE_ID="main"
ENV CONFIG_ENGINE="docker"
ENV CONFIG_PORT=3000

RUN npm install

EXPOSE 3000

ENTRYPOINT ["npm", "start"]
