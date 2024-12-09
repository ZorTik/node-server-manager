<!--![nsmlogopracovni2-better](https://github.com/user-attachments/assets/ea250212-6e89-489f-b582-9d6be1997524)-->

# Node Server Manager (NSM)

NSM is a robust service manager built on Docker Engine. Its primary purpose is to facilitate dynamic service generation using REST protocol from predefined templates, making it an essential tool for large game networks, service hosting providers and basically everyone whose goal is to scale on the run.

## Features

- **Dynamic Service Generation**: Create and manage services on-the-fly using RESTful APIs.
- **Template-Based Configuration**: Use customizable templates to define service configurations.
- **No-template mode**: NSM supports integrating custom engine with no template mode to disable templates completely.
- **Docker Integration**: Leverage Docker Engine for reliable and scalable service management.
- **Resources usage management**: NSM provides ability to limit or extend resources limits and view current usage.
- **Cluster-ready (in development)**: NSM is built to be used in a cluster. For more reference, head up to the wiki (soon).
- **Redis support (in development)**: The system is able to share information about state via redis.

## API Specification
<a href="https://zortik.github.io/nsm-spec/" target="_blank">Specification is hosted on external repository here</a>

## Prerequisites

Ensure you have the following installed before proceeding with the installation:

- Node.js (v14 or higher)
- Docker
- npm (Node Package Manager)

## Installation

Follow these steps to install and set up NSM:

1. **Clone the Repository**
   ```sh
   git clone https://github.com/ZorTik/node-server-manager
   ```
   Alternatively, download the latest release from the [NSM repository](https://github.com/ZorTik/node-server-manager) and extract it.

2. **Configure Environment Variables**
   Copy the example environment file and fill in the required values:
   ```sh
   cp .env.example .env
   ```
   Open the `.env` file and provide the necessary configuration values.

3. **Edit Configuration**
   Adjust the default configuration settings in `resources/config.yml` according to your requirements. You can also override these settings using environment variables. Detailed information about each configuration option is available within the file.

4. **Install Dependencies**
   Install the required Node.js packages:
   ```sh
   npm install
   ```

5. **Generate Prisma Client**
   Generate the Prisma client for database interaction:
   ```sh
   npx prisma generate
   ```

6. **Sync Database Schema**
   Apply the database schema migrations:
   ```sh
   npx prisma migrate deploy
   ```

7. **Build the Project**
   Compile the project for production:
   ```sh
   npm run build
   ```

## Running NSM

To start the NSM service, use the following command:

```sh
npm start
```

This will launch the NSM server, making it ready to handle requests and manage services dynamically.

## Contributing

Contributions to NSM are welcome! If you encounter any issues or have suggestions for improvements, please [open an issue](https://github.com/ZorTik/node-server-manager/issues) or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/ZorTik/node-server-manager/blob/main/LICENSE) file for more details.

## Contact

For any questions or support, please contact me (maintainer) via [GitHub Issues](https://github.com/ZorTik/node-server-manager/issues) or my website.

---

For documentation, refer to the project repository. Detailed wiki is planned soon.
