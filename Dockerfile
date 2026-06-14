FROM node:22

WORKDIR /data

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

# Copy config files
COPY *.config.js ./
COPY tsconfig.json .tscprc ./

# Copy resources and source code
COPY resources ./resources
COPY src ./src
COPY index.ts ./

RUN npm run build

CMD npm start