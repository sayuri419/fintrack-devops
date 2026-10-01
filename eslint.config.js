'use strict';

const js = require('@eslint/js');
const globals = require('globals');

// Custom maintainability rules on top of the recommended set. These mirror the
// SonarQube quality profile so developers get the same feedback locally.
module.exports = [
  { ignores: ['coverage/**', 'reports/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-lines-per-function': ['warn', { max: 60, skipComments: true, skipBlankLines: true }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.jest } },
    rules: { 'max-lines-per-function': 'off' },
  },
  {
    files: ['scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
];
