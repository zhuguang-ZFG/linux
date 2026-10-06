import assert from 'node:assert/strict';
import test from 'node:test';
import { checkChapterNavigation, readNavigation } from './chapter-navigation.mjs';

const order = ['docs/00-onboarding/a.md', 'docs/01-basics/b.md', 'docs/05-raspberry-pi/c.md'];
const pages = {
  [order[0]]: '# A\n\n⬅️ [开始](../00-如何使用本教程.md) ｜ ➡️ [B](../01-basics/b.md)',
  [order[1]]: '# B\n\n> ⬅️ 上一章：[A](../00-onboarding/a.md) ｜ ➡️ 下一章：[C](../05-raspberry-pi/c.md)',
  [order[2]]: '# C\n\n> ⬅️ [路线图](../../README.md) ｜ ➡️ [完成](../../LEARNING_PATHS.md)',
};

test('accepts the ordered main course and independent Raspberry Pi entry', () => {
  assert.deepEqual(checkChapterNavigation(order, name => pages[name]), []);
});

test('detects a link that exists but silently skips the next chapter', () => {
  const changed = { ...pages, [order[0]]: pages[order[0]].replace('../01-basics/b.md', '../05-raspberry-pi/c.md') };
  const issues = checkChapterNavigation(order, name => changed[name]);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /next should link to docs\/01-basics\/b.md/);
});

test('detects a wrong previous link independently of the next link', () => {
  const changed = { ...pages, [order[1]]: pages[order[1]].replace('../00-onboarding/a.md', '../01-basics/b.md') };
  assert.match(checkChapterNavigation(order, name => changed[name])[0], /previous should link/);
});

test('does not accept navigation appearing only in later sample content', () => {
  assert.equal(readNavigation('\n'.repeat(20) + pages[order[0]]), null);
});

test('supports CRLF and encoded relative destinations', () => {
  const changed = { ...pages, [order[0]]: pages[order[0]].replace('b.md', '%62.md').replaceAll('\n', '\r\n') };
  assert.deepEqual(checkChapterNavigation(order, name => changed[name]), []);
});

test('reports malformed encoding without aborting the remaining checks', () => {
  const changed = { ...pages, [order[1]]: pages[order[1]].replace('../00-onboarding/a.md', '%ZZ.md') };
  assert.match(checkChapterNavigation(order, name => changed[name])[0], /malformed previous link/);
});
