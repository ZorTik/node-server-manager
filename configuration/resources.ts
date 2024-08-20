import * as fs from "fs";

// Read resource from resources dir
export function readResource(name: string) {
    return fs.readFileSync(process.cwd() + '/resources/' + name, 'utf8');
}

// Copy resource to target dir
export function saveResource(name: string, target: string) {
    fs.writeFileSync(target, readResource(name));
}

export function prepareResources(test: boolean) {
    const cwd = process.cwd();
    if (!fs.existsSync(cwd + '/templates')) {
        fs.mkdirSync(cwd + '/templates');
        fs.mkdirSync(cwd + '/templates/example_minecraft');
        // Copy resources to example template
        saveResource('template/example/example_settings.yml', cwd + '/templates/example_minecraft/settings.yml');
        saveResource('template/example/example_dockerfile', cwd + '/templates/example_minecraft/Dockerfile');
        saveResource('template/example/example_nsmignore', cwd + '/templates/example_minecraft/.nsmignore');
    }
    if (test && !fs.existsSync(cwd + '/templates/test')) {
        fs.mkdirSync(cwd + '/templates/test');
        saveResource('template/test/test_settings.yml', cwd + '/templates/test/settings.yml');
        saveResource('template/test/test_dockerfile', cwd + '/templates/test/Dockerfile');
        saveResource('template/test/test_nsmignore', cwd + '/templates/test/.nsmignore');
    }
}