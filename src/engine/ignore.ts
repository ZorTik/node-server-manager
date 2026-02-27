import fs from "fs";
import ignore from "ignore";

export const getRootFilesFiltered = (dir: string) => {
    let filtered = fs.readdirSync(dir);
    if (fs.existsSync(dir + '/.nsmignore')) {
        const ig = buildIgnore(dir);

        filtered = ig.filter(filtered);
    }

    return filtered;
}

export const getFilteredPaths = (dir: string) => {
    const ig = buildIgnore(dir);

    let filtered = {
        files: [] as string[],
        dirs: [] as string[]
    };
    const walk = (currentDir: string) => {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
            const relativePath = currentDir === dir ? file : currentDir.substring(dir.length + 1) + '/' + file;
            const fullPath = currentDir + '/' + file;

            if (ig.ignores(relativePath)) {
                const isDir = fs.statSync(fullPath).isDirectory();
                if (isDir) {
                    filtered.dirs.push(relativePath);
                } else {
                    filtered.files.push(relativePath);
                }

                if (isDir) {
                    // If it's a directory, we need to ignore all its contents as well, so we skip walking into it
                    continue;
                }
            }

            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath);
            }
        }
    }
    walk(dir);

    return filtered;
}

const buildIgnore = (dir: string) => {
    const ig = ignore();
    if (fs.existsSync(dir + '/.nsmignore')) {
        ig.add(fs.readFileSync(dir + '/.nsmignore', 'utf8'));
    }

    return ig;
}