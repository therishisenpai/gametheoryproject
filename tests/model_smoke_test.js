'use strict';
const assert = require('node:assert/strict');
const { findEquilibrium, competitionExperiment, DEFAULT_PROVIDERS } = require('../app.js');

function close(actual, expected, label, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

const equilibrium = findEquilibrium(DEFAULT_PROVIDERS, 2000, 1.2);
close(equilibrium.prices[0], 3.1256281407035176, 'AWS-like equilibrium price');
close(equilibrium.prices[1], 3.364321608040201, 'Azure-like equilibrium price');
close(equilibrium.prices[2], 3.2688442211055277, 'GCP-like equilibrium price');
close(equilibrium.rows[0].demand, 771.2967555924523, 'AWS-like demand');
close(equilibrium.rows[1].profit, 674.3704860280272, 'Azure-like profit');
assert.equal(equilibrium.iterations, 4);
assert.equal(equilibrium.converged, true);

const competition = competitionExperiment();
assert.deepEqual(competition.map(row => row.nProviders), [2, 3, 4, 5, 6]);
close(competition[0].avgPrice, 3.3165829145728645, '2-provider average price');
close(competition[4].avgPrice, 2.791457286432161, '6-provider average price');
console.log('PASS: browser model matches the verified baseline values.');
