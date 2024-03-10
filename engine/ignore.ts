import fs from "fs";
import ignore from "ignore";

export default function (dir: string) {
    let filtered = fs.readdirSync(dir);
    if (fs.existsSync(dir + '/.nsmignore')) {
        const ig = ignore().add(fs.readFileSync(dir + '/.nsmignore', 'utf8').split('\n'));
        filtered = ig.filter(filtered);
    }
    return filtered;
}