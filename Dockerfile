FROM node:18

WORKDIR /data

COPY . .

RUN npm install
RUN npm install -g prisma

RUN npx prisma generate

RUN npm run build

CMD npx prisma migrate deploy && npm run start