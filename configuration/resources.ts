import * as fs from "fs";

// Read resource from resources dir
export function readResource(name: string) {
    return fs.readFileSync(process.cwd() + '/resources/' + name, 'utf8');
}

// Copy resource to target dir
export function saveResource(name: string, target: string) {
    fs.writeFileSync(target, readResource(name));
}

export function prepareResources() {
    const cwd = process.cwd();
    if (!fs.existsSync(cwd + '/templates')) {
        fs.mkdirSync(cwd + '/templates');
        fs.mkdirSync(cwd + '/templates/example_minecraft');
        // Copy resources to example template
        saveResource('example_settings.yml', cwd + '/templates/example_minecraft/settings.yml');
        saveResource('example_dockerfile', cwd + '/templates/example_minecraft/Dockerfile');
        saveResource('example_nsmignore', cwd + '/templates/example_minecraft/.nsmignore');
    }
}