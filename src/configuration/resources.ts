import * as fs from "fs";

// Read resource from resources dir
export function readResource(name: string) {
    return fs.readFileSync(process.cwd() + '/resources/' + name, 'utf8');
}

// Copy resource to target dir
export function saveResource(name: string, target: string) {
    fs.writeFileSync(target, readResource(name));
}

export function prepareTemplatesFolder() {
    const cwd = process.cwd();
    if (fs.existsSync(cwd + '/templates')) {
        return;
    }

    fs.mkdirSync(cwd + '/templates');
}

export function prepareTestResources() {
    const cwd = process.cwd();
    if (fs.existsSync(cwd + '/templates/test')) {
        return;
    }

    fs.mkdirSync(cwd + '/templates/test');
    saveResource('template/test/test_settings.yml', cwd + '/templates/test/settings.yml');
    saveResource('template/test/test_dockerfile', cwd + '/templates/test/Dockerfile');
    saveResource('template/test/test_nsmignore', cwd + '/templates/test/.nsmignore');
}