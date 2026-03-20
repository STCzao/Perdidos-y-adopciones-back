/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testTimeout: 30000,
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  setupFiles: ["<rootDir>/tests/setup/env.js"],
  collectCoverageFrom: [
    "service/**/*.js",
    "controllers/**/*.js",
    "middlewares/**/*.js",
    "helpers/**/*.js",
    "!helpers/localidades.js",
    "!helpers/razas.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
};
