const deps: { [id: string]: any } = {};

export type RegType = 'engine'; // Registration types

export function setSingleton(key: RegType, obj: any) {
    deps[key] = obj;
}

export function getSingleton<T>(key: RegType): T|undefined {
    return deps[key];
}

export function getSingletonOrDef<T>(key: RegType, def: T): T {
    return deps[key] ?? def;
}