import * as fs from "fs";

// Read resource from resources dir
export function readResource(name: string) {
    return fs.readFileSync(process.cwd() + '/resources/' + name, 'utf8');
}

// Copy resource to target dir
export function saveResource(name: string, dir: string) {
    fs.writeFileSync(dir + '/' + name, readResource(name));
}

export function prepareResources() {
    const cwd = process.cwd();
    if (!fs.existsSync(cwd + '/templates')) {
        fs.mkdirSync(cwd + '/templates/example');
        // Copy resources to example template
        saveResource('example_settings.yml', cwd + '/templates/example');
        saveResource('example_dockerfile', cwd + '/templates/example');
    }
}