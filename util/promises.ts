export async function resolveSequentially(...funcs: (() => any)[]) {
    for (const func of funcs) {
        await func();
    }
}