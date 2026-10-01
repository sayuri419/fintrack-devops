'use strict';

// Two projects so Jenkins can run and report unit and integration tests separately.
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'cobertura'],
  // Quality gate inside the test stage: the build fails if coverage drops below these.
  coverageThreshold: {
    global: { statements: 85, branches: 75, functions: 85, lines: 85 },
  },
  projects: [
    { displayName: 'unit', testEnvironment: 'node', testMatch: ['<rootDir>/tests/unit/**/*.test.js'], setupFiles: ['<rootDir>/tests/setup.js'] },
    { displayName: 'integration', testEnvironment: 'node', testMatch: ['<rootDir>/tests/integration/**/*.test.js'], setupFiles: ['<rootDir>/tests/setup.js'] },
  ],
};
