import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGsiConfig, PHASE1_DATA_BLOCKS, GSI_CFG_FILENAME } from './gsi-cfg.ts';

test('renderGsiConfig: contains the loopback uri, token, and heartbeat', () => {
  const cfg = renderGsiConfig({ uri: 'http://127.0.0.1:3100/', token: 'secret123' });
  assert.match(cfg, /"uri"\s+"http:\/\/127\.0\.0\.1:3100\/"/);
  assert.match(cfg, /"token"\s+"secret123"/);
  assert.match(cfg, /"heartbeat" "30\.0"/);
});

test('renderGsiConfig: requests exactly the Phase 1 data blocks and NOT draft', () => {
  const cfg = renderGsiConfig({ uri: 'http://127.0.0.1:3100/', token: 't' });
  for (const block of PHASE1_DATA_BLOCKS) {
    assert.match(cfg, new RegExp(`"${block}"\\s+"1"`), `should request the ${block} block`);
  }
  assert.doesNotMatch(cfg, /"draft"\s+"1"/, 'draft block is intentionally omitted (GSI cannot see enemy picks)');
});

test('renderGsiConfig: honors custom data blocks', () => {
  const cfg = renderGsiConfig({ uri: 'u', token: 't', dataBlocks: ['hero', 'map'] });
  assert.match(cfg, /"hero"\s+"1"/);
  assert.match(cfg, /"map"\s+"1"/);
  assert.doesNotMatch(cfg, /"items"\s+"1"/);
});

test('renderGsiConfig: output is stable/deterministic for the same input', () => {
  const opts = { uri: 'http://127.0.0.1:3100/', token: 'abc' };
  assert.equal(renderGsiConfig(opts), renderGsiConfig(opts), 're-render is idempotent');
});

test('GSI_CFG_FILENAME is the expected gamestate_integration file', () => {
  assert.equal(GSI_CFG_FILENAME, 'gamestate_integration_rankup.cfg');
});
