import assert from 'node:assert/strict';
import { atlasData, heatColor } from '../js/atlas.js';

// Synthetic numeric fixtures only; never part of demo data.
const r = {
  sampleMeta: ['a','b','c'].map((id,i)=>({id,donor:'D',passage:i+1})),
  records: {a:{genes:{varying:2,constant:7,missing:null}},
            b:{genes:{varying:4,constant:7,missing:5}},
            c:{genes:{varying:6,constant:7,missing:9}}},
};
const d=atlasData(r);
assert.ok(Math.abs(d.z('varying',2)+Math.sqrt(1.5))<1e-12);
assert.equal(d.z('varying',4),0);
assert.equal(d.z('constant',7),0);
assert.equal(d.z('missing',null),null);
assert.equal(d.stats.missing.mean,7);
assert.equal(d.z('missing',5),-1);
assert.equal(heatColor(null),'#e5e7eb');
assert.equal(heatColor(100),heatColor(2.5));
assert.equal(heatColor(-100),heatColor(-2.5));
assert.notEqual(heatColor(-1),heatColor(1));
console.log('PASS: heatmap normalization, constant genes, missing values and symmetric color saturation');
