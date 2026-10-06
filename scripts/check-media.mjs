import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(path.join(root, name), 'utf8');
const videos = JSON.parse(read('resources/videos.json')).videos;
const mapping = JSON.parse(read('resources/chapter-media.json'));
const animations = JSON.parse(read('assets/animations/catalog.json'));
const chapters = [...read('README.md').matchAll(/\]\((docs\/[^)]+\.md)\)/g)].map(match => match[1]);
const ids = new Set();
const providerKeys = new Set();
for (const video of videos) {
  assert(!ids.has(video.id), `Duplicate video id: ${video.id}`); ids.add(video.id);
  const key = `${video.platform}:${video.providerId}:${video.cid || 0}`;
  assert(!providerKeys.has(key), `Duplicate video/part: ${key}`); providerKeys.add(key);
  assert(video.title && video.author && video.providerTitle && video.tags.length, `Incomplete metadata: ${video.id}`);
  assert(video.duration === null || (Number.isInteger(video.duration) && video.duration > 0), `Invalid duration: ${video.id}`);
  assert.equal(new URL(video.thumbnail).protocol, 'https:');
  if (video.platform === 'bilibili') {
    assert.match(video.providerId, /^BV[a-zA-Z0-9]{10}$/);
    assert(Number.isInteger(video.page) && video.page >= 1);
    assert(Number.isInteger(video.cid) && video.cid > 0);
    assert.equal(new URL(video.url).hostname, 'www.bilibili.com');
    assert.equal(Number(new URL(video.url).searchParams.get('p')), video.page);
  } else {
    assert.equal(video.platform, 'youtube');
    assert.match(video.providerId, /^[\w-]{11}$/);
    assert.equal(new URL(video.url).hostname, 'www.youtube.com');
    assert.equal(new URL(video.url).searchParams.get('v'), video.providerId);
  }
  assert.equal(video.verification.metadata, 'verified');
  assert(!Number.isNaN(Date.parse(video.verification.checkedAt)));
  assert(['not_tested', 'verified', 'unavailable'].includes(video.verification.playback));
  if (video.verification.playback === 'verified') assert(video.verification.playbackEvidence, 'Playback claims need separate evidence');
}
assert.deepEqual(Object.keys(mapping).sort(), [...chapters].sort());
const animationIds = new Set(animations.map(item => item.file));
for (const [chapter, media] of Object.entries(mapping)) {
  assert(existsSync(path.join(root, chapter)));
  for (const ref of media.videos) { assert(ids.has(ref.id), `Unknown video ${ref.id}`); assert(ref.note); }
  for (const file of media.animations) assert(animationIds.has(file), `Unknown animation ${file}`);
}
console.log(`PASS: ${videos.length} verified video/part records, ${chapters.length} deliberate chapter mappings, ${animations.length} animation references`);
