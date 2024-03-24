# Node Server Manager (NSM)
A simple service manager built on docker engine. You can generate almost any service from templates using REST protocol. This is useful for creating game servers dynamically from templates.

## Installation on Windows
To prepare NSM for production, go to the directory where you want to have NSM installed and do the following:
1. Clone NSM using `git clone https://github.com/ZorTik/node-server-manager` or **download latest release** from this page and **extract** it
2. Fill up .env file from template at `.env.example`
3. Edit default configuration in `config.yml` or override it using env variables (More info in config.yml)
4. Run `npm install`
5. Run `npx prisma generate` to generate Prisma client
6. Run `npx prisma migrate dev --name init` to sync database schema
7. Run `npm run build` to build the project

## Running NSM
Run `npm start` to start the server.

## Integrating addons
To integrate new addon, you need to either create your own one from template at `addons/example_addon` or download one and put it in the `addons` folder.
Then, follow these steps:
1. Download or create an addon in `addons/<youraddonidhere>` directory
2. Run `npm run build` to rebuild the project

## Creating a template
TODO
## Using the NSM API for managing services
TODO