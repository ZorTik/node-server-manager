export function isDebug() {
    return process.env.DEBUG === 'true';
}

export function consumeEnginePowerAction(action: () => Promise<any>) {
    action().catch((e) => {
        // Manager service power action errors are ignored since
        // they are handled by the middle-layer defined in engine/middle.ts
    });
}