import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('data/validation/v1031-preservation.json',root)));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('v10.3.0 physics, scoring, science, records, encounters, rendering, audio and all original data/assets are byte-identical',()=>{
 for(const entry of manifest.files)assert.equal(hash(fs.readFileSync(new URL(entry.file,root))),entry.sha256,entry.file);
 const config=fs.readFileSync(new URL('src/config.js',root),'utf8');assert.equal(hash(config.split('\n').slice(1).join('\n')),manifest.configWithoutVersionSha256);
 const rules=JSON.parse(fs.readFileSync(new URL('data/mission-score-rules.json',root)));delete rules.gameVersion;assert.deepEqual(rules,manifest.scoringRulesWithoutGameVersion);
});
