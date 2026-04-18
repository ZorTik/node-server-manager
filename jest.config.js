const tsconfig = require("./tsconfig.json")
const moduleNameMapper = require("tsconfig-paths-jest")(tsconfig)

module.exports = {
    moduleNameMapper,
    transformIgnorePatterns: [
        "/node_modules/(?!(env-paths)/)",
    ],
    reporters: [
        'default',
        ['jest-ctrf-json-reporter', {}],
    ],
}