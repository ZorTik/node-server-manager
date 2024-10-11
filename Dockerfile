FROM node:18

WORKDIR /data

COPY . .

RUN npm install
RUN npm install -g prisma

RUN npx prisma generate
RUN npx prisma migrate deploy
RUN npm run build

CMD npm run start