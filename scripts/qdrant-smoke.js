'use strict';

const { runQdrantSmokeTest } = require('../lib/evidenceVectorStore');

runQdrantSmokeTest()
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.skipped && !result.ok) process.exitCode = 1;
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
