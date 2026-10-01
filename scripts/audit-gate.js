'use strict';

// Reads `npm audit --json` output, prints a readable summary and fails the build
// when HIGH or CRITICAL vulnerabilities exist in production dependencies.
const fs = require('fs');

const file = process.argv[2] || 'reports/npm-audit.json';
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const counts = report.metadata?.vulnerabilities || {};
const vulns = Object.values(report.vulnerabilities || {});

console.log('npm audit (production dependencies)');
console.log(`  critical=${counts.critical || 0} high=${counts.high || 0} moderate=${counts.moderate || 0} low=${counts.low || 0}`);

for (const v of vulns) {
  const fix = v.fixAvailable ? 'fix available' : 'no fix yet';
  console.log(`  - [${v.severity.toUpperCase()}] ${v.name} (${v.range}) - ${fix}`);
  for (const advisory of v.via.filter((a) => typeof a === 'object')) {
    console.log(`      ${advisory.url}  ${advisory.title}`);
  }
}

const blocking = (counts.critical || 0) + (counts.high || 0);
if (blocking > 0) {
  console.error(`FAILED: ${blocking} high/critical vulnerabilities must be fixed or formally accepted.`);
  process.exit(1);
}
console.log('PASSED: no high/critical vulnerabilities in production dependencies.');
