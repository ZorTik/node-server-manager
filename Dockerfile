FROM node:18

WORKDIR /data

# Copy addons before install to install dependencies for addons as well
COPY addons ./addons

COPY installTempDeps.js ./
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

CMD npx prisma migrate deploy && npm run start