import net from 'net';
import {ServiceEngine} from "../engine";

export async function isPortAvailable(engine: ServiceEngine, port: number, a_ports: number[] = undefined) {
    if (a_ports === undefined) {
        a_ports = await engine.listAttachedPorts();
    }
    if (a_ports.includes(port)) {
        return false;
    }
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

export async function randomPort(engine: ServiceEngine, from: number, to: number) {
    const checked = [];
    const all = await engine.listAttachedPorts();
    while (true) {
        const port = Math.floor(Math.random() * (to - from) + from);
        if (checked.includes(port)) {
            continue;
        }
        if (await isPortAvailable(engine, port, all)) {
            return port;
        }
        if (checked.length === to - from) {
            throw new Error('No available ports');
        }
        checked.push(port);
    }
}