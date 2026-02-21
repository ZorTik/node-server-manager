export function env(env: string[], options?: { required?: boolean }) {
    const values = env.map(k => k in process.env ? process.env[k] : undefined);
    const missing = values
        .map((v, i) => [v, i])
        .filter(([v]) => !v)
        .map(([_, i]) => env[i]);
    const required = options?.required ?? true;
    if (missing.length > 0 && required == true) {
        throw new Error('Missing env variables: ' + missing.join(', '));
    }
    return values;
}