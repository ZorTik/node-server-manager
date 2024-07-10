export type EventHandler = (evt: any) => Promise<void>|void;
export type BuiltInEventTypes = 'nsm:engine:deletev';

const handlers: { [type: string]: EventHandler[] } = {};

export function registerEventHandler(type: BuiltInEventTypes|string, handler: EventHandler) {
    if (!handlers[type]) {
        handlers[type] = [];
    }
    handlers[type].push(handler);
}

export async function callEvent(type: BuiltInEventTypes|string, event: any) {
    if (!handlers.hasOwnProperty(type)) {
        return;
    }
    let res = Promise.resolve();
    for (const handler of handlers[type]) {
        res = res.then(() => handler(event));
    }
    return res;
}