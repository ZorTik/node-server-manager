export function env(env: string[], options?: { required?: boolean }) {
    const required = options?.required ?? true;
    const values = [];
    const missing = [];
    for (let i = 0; i < env.length; i++) {
        const key = env[i];
        let value = undefined;
        if (key in process.env) {
            value = process.env[key];
        } else {
            missing.push(key);
        }
        values.push(value);
    }
    if (missing.length > 0 && required == true) {
        throw new Error('Missing env variables: ' + missing.join(', '));
    }
    return values;
}