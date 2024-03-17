const fs = require("fs");
const npm = require("npm");

console.log('Preinstalling dependencies for build...');

npm.load().then(() => {
    for (let addon of fs.readdirSync(process.cwd() + '/addons')) {
        const libFPath = process.cwd() + '/addons/' + addon + '/libraries.txt';
        if (!fs.existsSync(libFPath)) {
            continue;
        }
        const libs = fs.readFileSync(libFPath, 'utf8').split('\n')
            .map((lib) => lib.split('=')[0] + '@' + lib.split('=')[1]);
        npm.commands.install(libs, (err) => {
            console.log(err);
        });
    }
});