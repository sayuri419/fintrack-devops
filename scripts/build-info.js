'use strict';

// Writes build-info.json into the artefact so every image is traceable to a commit.
const fs = require('fs');
const pkg = require('../package.json');

const info = {
  name: pkg.name,
  version: process.env.APP_VERSION || pkg.version,
  commit: process.env.GIT_COMMIT || 'local',
  buildNumber: process.env.BUILD_NUMBER || '0',
  builtAt: new Date().toISOString(),
};

fs.writeFileSync('build-info.json', JSON.stringify(info, null, 2));
console.log('build-info.json written:', info);
