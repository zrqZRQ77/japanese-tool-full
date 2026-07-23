#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const registry = JSON.parse(readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/source-registry.json'), 'utf8'));
const plan = readFileSync(resolve(ROOT, 'audits/offline-chinese-coverage/20260723/SOURCE_AND_LICENSE_PLAN.md'), 'utf8');

assert.equal(registry.schemaVersion, 1);
assert.equal(registry.reviewedAt, '2026-07-23');
assert.equal(registry.sources.length, 7);
assert.equal(new Set(registry.sources.map(source => source.id)).size, registry.sources.length);

const byId = Object.fromEntries(registry.sources.map(source => [source.id, source]));
assert.equal(byId['yomeru-curated-chinese'].status, 'approved-primary');
assert.equal(byId['jmdict-edrdg'].licenseClass, 'CC-BY-SA-4.0');
assert.equal(byId['jmdict-edrdg'].commercialUse, true);
assert.match(byId['jmdict-edrdg'].requirements.join('\n'), /About\/Sources/);
assert.equal(byId.wikidata.licenseClass, 'CC0-1.0');
assert.equal(byId['wiktionary-text'].status, 'conditional-isolated-evidence');
assert.equal(byId.tatoeba.licenseClass, 'CC-BY-2.0-FR-or-CC0-per-record');
assert.equal(byId['ai-draft'].status, 'draft-only');
assert.equal(byId['unknown-or-commercial-dictionaries'].status, 'prohibited');
assert.equal(byId['unknown-or-commercial-dictionaries'].commercialUse, false);

assert.match(plan, /不构成法律意见/);
assert.match(plan, /正式中文释义继续以 Yomeru 人工审核数据为唯一发布层/);
assert.match(plan, /Wikidata 结构化数据/);
assert.match(plan, /Wiktionary \/ Wikimedia 文字/);
assert.match(plan, /Tatoeba 例句/);
assert.match(plan, /AI 只能生成待审核草稿/);
assert.match(plan, /未明确授权的商业词典/);
assert.match(plan, /每条候选的最低审计字段/);
assert.match(plan, /发布门禁/);

process.stdout.write('Offline Chinese source and license registry tests passed.\n');
