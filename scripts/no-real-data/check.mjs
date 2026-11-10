#!/usr/bin/env node
// Fails the build when a file in the repository looks like it holds real
// financial data, personal information or a secret. Standard library only.
//
// It is a safety net, not proof of absence. It cannot recognise names, free
// text or the contents of images, so pull request review still applies.
//
// Findings never echo the matched text, because CI logs on a public
// repository are public too.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FIXTURE_DIR = 'fixtures/synthetic/';
export const CONFIG_FILE = '.no-real-data.json';

// Text formats that may be committed, but only as synthetic fixtures.
const TEXT_FIXTURE_EXT = new Set(['.csv', '.tsv', '.eml']);
// Formats that look like statements or exports. Never allowed elsewhere.
const DATA_EXT = new Set([
  '.csv', '.tsv', '.eml', '.msg', '.mbox',
  '.xlsx', '.xlsm', '.xlsb', '.xls', '.ods', '.numbers',
  '.pdf', '.zip', '.7z', '.rar', '.tar', '.gz', '.tgz',
]);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg']);
const IMAGE_DIRS = ['docs/', 'assets/'];
const MAX_TEXT_BYTES = 1024 * 1024;

// Well-known documentation and test values. Allowed so that examples work.
const KNOWN_TEST_CARDS = new Set([
  '4111111111111111', '4242424242424242', '4012888888881881',
  '5555555555554444', '5105105105105100', '378282246310005',
  '371449635398431', '6011111111111117',
]);
const KNOWN_EXAMPLE_IBANS = new Set([
  'GB82WEST12345698765432', 'DE89370400440532013000', 'FR1420041010050500013M02606',
]);
const RESERVED_DOMAINS = new Set(['example.com', 'example.org', 'example.net']);
const RESERVED_SUFFIXES = ['.example', '.test', '.invalid', '.localhost'];

const GROUPED_CARD = /\b\d{4}(?:[ -]\d{4}){2,3}\b|\b\d{4}[ -]\d{6}[ -]\d{5}\b/g;
const LONG_DIGITS = /\b\d{12,}\b/g;
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g;
const AM_PHONE = /\+374[\s().-]*(?:\d[\s().-]*){8}(?!\d)/g;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const SECRETS = [
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, 'private key block'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
];

export function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function ibanValid(iban) {
  const moved = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of moved) {
    const value = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

const isRepeatedDigit = (digits) => /^(\d)\1+$/.test(digits);

function emailAllowed(address, domain, config) {
  const d = domain.toLowerCase();
  if (RESERVED_DOMAINS.has(d)) return true;
  if (RESERVED_SUFFIXES.some((s) => d.endsWith(s))) return true;
  if (config.allowedEmailDomains.includes(d)) return true;
  return config.allowedEmails.includes(address.toLowerCase());
}

export function loadConfig(root) {
  const path = join(root, CONFIG_FILE);
  const base = { allowedEmails: [], allowedEmailDomains: [], ignorePaths: [] };
  if (!existsSync(path)) return base;
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return {
    allowedEmails: (parsed.allowedEmails ?? []).map((s) => s.toLowerCase()),
    allowedEmailDomains: (parsed.allowedEmailDomains ?? []).map((s) => s.toLowerCase()),
    ignorePaths: parsed.ignorePaths ?? [],
  };
}

function scanLine(line, config, report) {
  const flaggedDigitRuns = new Set();

  for (const m of line.matchAll(GROUPED_CARD)) {
    const digits = m[0].replace(/[ -]/g, '');
    if (isRepeatedDigit(digits) || KNOWN_TEST_CARDS.has(digits)) continue;
    if (luhnValid(digits)) report('card-number', 'Number that passes the card checksum. Use an obviously fake value such as all zeros.');
  }

  for (const m of line.matchAll(LONG_DIGITS)) {
    const digits = m[0];
    if (isRepeatedDigit(digits) || KNOWN_TEST_CARDS.has(digits)) continue;
    flaggedDigitRuns.add(digits);
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      report('card-number', 'Number that passes the card checksum. Use an obviously fake value such as all zeros.');
    } else {
      report('account-number', `Run of ${digits.length} digits that could be an account number. Use an obviously fake value such as all zeros.`);
    }
  }

  for (const m of line.matchAll(IBAN)) {
    const iban = m[0].replace(/ /g, '');
    if (iban.length < 15 || iban.length > 34) continue;
    if (KNOWN_EXAMPLE_IBANS.has(iban)) continue;
    if (ibanValid(iban)) report('iban', 'Valid IBAN. Use a well-known documentation IBAN or an obviously fake value.');
  }

  for (const m of line.matchAll(AM_PHONE)) {
    const national = m[0].slice(4).replace(/\D/g, '');
    if (isRepeatedDigit(national) && national[0] === '0') continue;
    report('phone', 'Armenian phone number. Use all zeros after the country code.');
  }

  for (const m of line.matchAll(EMAIL)) {
    if (!emailAllowed(m[0], m[1], config)) {
      report('email', 'Email address on a real domain. Use a reserved domain such as example.com or a name ending in .example.');
    }
  }

  for (const [pattern, label] of SECRETS) {
    if (pattern.test(line)) report('secret', `Looks like a ${label}.`);
  }
}

export function scanFile(relPath, buffer, config) {
  const findings = [];
  const add = (line, rule, message) => findings.push({ file: relPath, line, rule, message });
  const ext = extname(relPath).toLowerCase();
  const inFixtures = relPath.startsWith(FIXTURE_DIR);

  if (config.ignorePaths.some((p) => relPath === p || relPath.startsWith(p))) return findings;

  if (DATA_EXT.has(ext) && !(inFixtures && TEXT_FIXTURE_EXT.has(ext))) {
    add(0, 'data-file', `${ext} files may not be committed. Synthetic text fixtures (.csv, .tsv, .eml) belong in ${FIXTURE_DIR}. Build spreadsheets from text at test time.`);
    return findings;
  }

  const isBinary = buffer.subarray(0, 8000).includes(0);
  if (isBinary) {
    const imageOk = IMAGE_EXT.has(ext) && IMAGE_DIRS.some((d) => relPath.startsWith(d));
    if (!imageOk) add(0, 'binary-file', `Binary file that cannot be reviewed. Images are allowed only under ${IMAGE_DIRS.join(' or ')}.`);
    return findings;
  }

  if (buffer.length > MAX_TEXT_BYTES) {
    add(0, 'large-file', 'Text file over 1 MB, which looks like a data dump. Add it to ignorePaths only if it is generated and contains no data.');
    return findings;
  }

  const lines = buffer.toString('utf8').split(/\r?\n/);
  lines.forEach((text, i) => scanLine(text, config, (rule, message) => add(i + 1, rule, message)));
  return findings;
}

export function scanFiles(root, files, config = loadConfig(root)) {
  const findings = [];
  for (const rel of files) {
    const full = join(root, rel);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    findings.push(...scanFile(rel, readFileSync(full), config));
  }
  return findings;
}

export function listFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root });
  return out.toString('utf8').split('\0').filter(Boolean);
}

function main() {
  const root = process.cwd();
  const files = listFiles(root);
  const findings = scanFiles(root, files);
  for (const f of findings) {
    console.error(`${f.file}${f.line ? `:${f.line}` : ''}: ${f.rule}: ${f.message}`);
  }
  if (findings.length > 0) {
    console.error(`\nno-real-data: ${findings.length} finding(s) in ${files.length} files. Matched text is not printed on purpose.`);
    process.exit(1);
  }
  console.log(`no-real-data: ${files.length} files scanned, 0 findings.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
