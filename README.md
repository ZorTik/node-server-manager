<div align="center">

# Node Server Manager (NSM)
A simple service manager built on docker engine. You can generate almost any service from templates using REST protocol. This is useful for creating game servers dynamically from templates.
</div>

## Installation
To prepare NSM for production, go to the directory where you want to have NSM installed and do the following:
- Clone NSM using `git clone https://github.com/ZorTik/node-server-manager` or **download latest release** from this page and **extract** it
- Fill up .env file from template at `.env.example`
- Edit default configuration in `config.yml` or override it using env variables (More info in config.yml)
- Run `npm install`
- Run `npx prisma generate` to generate Prisma client
- Run `npx prisma migrate dev --name <choose_migration_name>` to sync database schema
- Run `npm run build` to build the project

## Running NSM
Run `npm start` to start the server.

## Integrating addons
To integrate new addon, you need to either create your own one from template at `addons/example_addon` or download one and put it in the `addons` folder.
Then, follow these steps:
- Download or create an addon in `addons/<your_addon_id_here>` directory
- Run `npm run build` to rebuild the project