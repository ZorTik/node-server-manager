export function env(env: string[]) {
    const values = [];
    const missing = [];
    for (let i = 0; i < env.length; i++) {
        const key = env[i];
        if (key in process.env) {
            values.push(process.env[key]);
        } else {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        throw new Error('Missing env variables: ' + missing.join(', '));
    }
    return values;
}