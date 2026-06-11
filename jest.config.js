const tsconfig = require("./tsconfig.json");
const moduleNameMapper = require("tsconfig-paths-jest")(tsconfig);

module.exports = {
  moduleNameMapper,
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/"
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/dist/"
  ],
  transformIgnorePatterns: [
      "/node_modules/(?!(env-paths)/)"
  ],
  reporters: [
      "default",
      ["jest-ctrf-json-reporter", {}]
  ],
};
