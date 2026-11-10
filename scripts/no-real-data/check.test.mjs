// Tests for the no-real-data guard.
//
// Every violating value is built at run time. The guard scans this file too,
// so no literal that looks like real data may appear in it.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ibanValid, luhnValid, scanFile } from './check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const NO_CONFIG = { allowedEmails: [], allowedEmailDomains: [], ignorePaths: [] };
const CARD_PREFIX = ['4532', '0151', '1283', '036'].join('');

function withLuhnCheckDigit(prefix) {
  for (let d = 0; d < 10; d++) {
    if (luhnValid(prefix + d)) return prefix + d;
  }
  throw new Error('unreachable');
}

function withIbanCheckDigits(country, bban) {
  for (let n = 2; n <= 98; n++) {
    const candidate = country + String(n).padStart(2, '0') + bban;
    if (ibanValid(candidate)) return candidate;
  }
  throw new Error('unreachable');
}

const scan = (path, text, config = NO_CONFIG) => scanFile(path, Buffer.from(text), config);
const rules = (findings) => findings.map((f) => f.rule);

test('flags a number that passes the card checksum', () => {
  const card = withLuhnCheckDigit(CARD_PREFIX);
  assert.deepEqual(rules(scan('docs/a.md', `card ${card}`)), ['card-number']);
});

test('flags a grouped card number', () => {
  const card = withLuhnCheckDigit(CARD_PREFIX);
  const grouped = card.match(/.{4}/g).join(' ');
  assert.deepEqual(rules(scan('docs/a.md', `card ${grouped}`)), ['card-number']);
});

test('allows well-known test cards and repeated digits', () => {
  assert.deepEqual(scan('docs/a.md', 'card 4242424242424242 and 0000000000000000'), []);
});

test('flags a long digit run that is not a card as an account number', () => {
  const digits = '1234' + '56789012' + '3';
  assert.equal(luhnValid(digits), false);
  assert.deepEqual(rules(scan('docs/a.md', `account ${digits}`)), ['account-number']);
});

test('does not flag short numbers or dates', () => {
  assert.deepEqual(scan('docs/a.md', 'on 2026-11-10 paid 150000 AMD, ref 123456789'), []);
});

test('flags a valid IBAN and ignores a checksum failure', () => {
  const iban = withIbanCheckDigits('XX', 'ABCD' + '12345678' + '9012');
  assert.deepEqual(rules(scan('docs/a.md', `iban ${iban}`)), ['iban']);
  const broken = iban.slice(0, 2) + (iban[2] === '9' ? '8' : '9') + iban.slice(3);
  assert.deepEqual(scan('docs/a.md', `iban ${broken}`), []);
});

test('allows the well-known example IBAN', () => {
  assert.deepEqual(scan('docs/a.md', 'iban GB82WEST12345698765432'), []);
});

test('flags an Armenian phone number but allows all zeros', () => {
  const real = ['+374', '91', '123456'].join(' ');
  assert.deepEqual(rules(scan('docs/a.md', `call ${real}`)), ['phone']);
  const fake = ['+374', '00', '000000'].join(' ');
  assert.deepEqual(scan('docs/a.md', `call ${fake}`), []);
});

test('flags an email on a real domain and allows reserved ones', () => {
  const real = 'someone' + '@' + 'gmail.com';
  assert.deepEqual(rules(scan('docs/a.md', `mail ${real}`)), ['email']);
  assert.deepEqual(scan('docs/a.md', 'mail a' + '@' + 'example.com and b' + '@' + 'demo.example'), []);
});

test('config can allow a specific email and a domain', () => {
  const text = 'x' + '@' + 'corp.test2 y' + '@' + 'allowed.org';
  assert.deepEqual(rules(scan('docs/a.md', text)), ['email', 'email']);
  const config = { ...NO_CONFIG, allowedEmails: ['x' + '@' + 'corp.test2'], allowedEmailDomains: ['allowed.org'] };
  assert.deepEqual(scan('docs/a.md', text, config), []);
});

test('flags secret-shaped values', () => {
  const key = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  assert.deepEqual(rules(scan('docs/a.md', `key ${key}`)), ['secret']);
  const block = '-----BEGIN ' + 'PRIVATE KEY-----';
  assert.deepEqual(rules(scan('docs/a.md', block)), ['secret']);
});

test('rejects statement-like files outside the fixtures folder', () => {
  for (const name of ['march.xlsx', 'data/export.csv', 'mail/forward.eml', 'statement.pdf']) {
    assert.deepEqual(rules(scan(name, 'x')), ['data-file'], name);
  }
});

test('rejects spreadsheets even inside the fixtures folder', () => {
  assert.deepEqual(rules(scan('fixtures/synthetic/bank-a.xlsx', 'x')), ['data-file']);
});

test('allows clean text fixtures and scans them', () => {
  assert.deepEqual(scan('fixtures/synthetic/bank-a.csv', 'date,amount\n2026-11-01,1000.00'), []);
  const card = withLuhnCheckDigit(CARD_PREFIX);
  const findings = scan('fixtures/synthetic/bank-a.csv', `date,note\n2026-11-01,${card}`);
  assert.deepEqual(rules(findings), ['card-number']);
  assert.equal(findings[0].line, 2);
});

test('rejects unknown binary files and images outside docs or assets', () => {
  const binary = Buffer.from([0x89, 0x50, 0x00, 0x01]);
  assert.deepEqual(rules(scanFile('blob.bin', binary, NO_CONFIG)), ['binary-file']);
  assert.deepEqual(rules(scanFile('shot.png', binary, NO_CONFIG)), ['binary-file']);
  assert.deepEqual(scanFile('docs/diagram.png', binary, NO_CONFIG), []);
});

test('rejects very large text files', () => {
  const big = Buffer.alloc(1024 * 1024 + 1, 'a');
  assert.deepEqual(rules(scanFile('dump.txt', big, NO_CONFIG)), ['large-file']);
});

test('ignorePaths skips a path', () => {
  const card = withLuhnCheckDigit(CARD_PREFIX);
  const config = { ...NO_CONFIG, ignorePaths: ['vendor/'] };
  assert.deepEqual(scan('vendor/x.md', card, config), []);
});

test('the command line fails on a violation and never prints the matched text', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nrd-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  const card = withLuhnCheckDigit(CARD_PREFIX);
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'notes.md'), `paid with ${card}\n`);
  let status = 0;
  let stderr = '';
  try {
    execFileSync('node', [join(here, 'check.mjs')], { cwd: dir, stdio: 'pipe' });
  } catch (error) {
    status = error.status;
    stderr = error.stderr.toString();
  }
  assert.equal(status, 1);
  assert.match(stderr, /docs\/notes\.md:1: card-number/);
  assert.equal(stderr.includes(card), false);
});

test('the command line passes on a clean tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nrd-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'README.md'), '# clean\n');
  const out = execFileSync('node', [join(here, 'check.mjs')], { cwd: dir }).toString();
  assert.match(out, /0 findings/);
});
