const tsconfig = require("./tsconfig.json")
const moduleNameMapper = require("tsconfig-paths-jest")(tsconfig)

module.exports = {
    "modulePathIgnorePatterns": [
        "<rootDir>/tests/"
    ],
    moduleNameMapper,
}