'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function listFiles(relativePath, predicate = () => true) {
  const dir = path.join(ROOT, relativePath);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((entry) => fs.statSync(path.join(dir, entry)).isFile())
    .filter(predicate)
    .sort();
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

const failures = [];
const requiredFiles = [
  'run.py',
  'metadata.json',
  '.env.example',
  'README.md',
  'requirements.txt',
  'api/run.js',
  'api/metadata.js',
  'lib/evaluatorRun.js'
];

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`Missing required submission file: ${file}`);
}

for (const jsonFile of ['metadata.json']) {
  try {
    readJson(jsonFile);
  } catch (error) {
    failures.push(`Invalid JSON in ${jsonFile}: ${error.message}`);
  }
}

const inputExamples = listFiles('input_examples', (entry) => entry.endsWith('.json'));
if (inputExamples.length < 3) failures.push(`Expected at least 3 JSON input examples, found ${inputExamples.length}.`);
for (const file of inputExamples) {
  try {
    readJson(path.join('input_examples', file));
  } catch (error) {
    failures.push(`Invalid input example ${file}: ${error.message}`);
  }
}

const outputExamples = listFiles('output_examples', (entry) => entry.endsWith('.json') || entry.endsWith('.jsonl') || entry.endsWith('.pdf'));
if (outputExamples.length < 3) failures.push(`Expected at least 3 output examples, found ${outputExamples.length}.`);

const logSamples = listFiles('logs', (entry) => entry.endsWith('.sample.jsonl'));
if (logSamples.length < 1) failures.push('Expected at least one committed sample JSONL log under logs/.');

const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
for (const envName of ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'COMPASS_GATEWAY_TOKEN', 'QDRANT_URL']) {
  if (!env.includes(envName)) failures.push(`.env.example does not mention ${envName}.`);
}

const metadata = exists('metadata.json') ? readJson('metadata.json') : {};
if (metadata.use_case_id !== '21') failures.push('metadata.json use_case_id must be "21" for the legal/compliance track.');
if (metadata.entrypoint !== 'run.py') failures.push('metadata.json entrypoint must be run.py.');
if (metadata.api?.run_endpoint !== 'POST /run') failures.push('metadata.json api.run_endpoint must be POST /run.');
if (metadata.sample_mode_supported === true) {
  const orchestrator = fs.readFileSync(path.join(ROOT, 'app/agentathon_orchestrator.py'), 'utf8');
  if (!orchestrator.includes('skipped_sample_mode') || !orchestrator.includes('sample_mode')) {
    failures.push('metadata.json claims sample_mode_supported but the Agentathon wrapper sample-mode branch was not detected.');
  }
} else if (metadata.sample_mode_supported !== false) {
  failures.push('metadata.json sample_mode_supported must be a boolean.');
}

const pythonCheck = spawnSync('python3', ['-m', 'py_compile', 'run.py'], {
  cwd: ROOT,
  encoding: 'utf8'
});
if (pythonCheck.status !== 0) {
  failures.push(`run.py failed Python syntax check: ${pythonCheck.stderr || pythonCheck.stdout}`);
}

if (failures.length) {
  throw new Error([
    'Submission compatibility check failed:',
    ...failures.map((failure) => `- ${failure}`)
  ].join('\n'));
}

process.stdout.write([
  'Submission compatibility check passed.',
  `Input examples: ${inputExamples.length}`,
  `Output examples: ${outputExamples.length}`,
  `Sample logs: ${logSamples.length}`,
  ''
].join('\n'));
