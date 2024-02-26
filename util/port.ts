import net from 'net';

export async function isPortAvailable(port: number) {
    const server = net.createServer();
    return new Promise<boolean>(resolve => {
        server.once('error', () => {
            resolve(false);
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

export async function randomPort(from: number, to: number) {
    const checkedPorts = [];
    while (true) {
        const port = Math.floor(Math.random() * (to - from) + from);
        if (checkedPorts.includes(port)) {
            continue;
        }
        if (await isPortAvailable(port)) {
            return port;
        }
        if (checkedPorts.length === to - from) {
            throw new Error('No available ports');
        }
        checkedPorts.push(port);
    }
}