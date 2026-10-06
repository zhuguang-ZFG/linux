import path from 'node:path';

// Only inspect the chapter's opening navigation, never examples or later prose.
export function readNavigation(markdown) {
  const opening = markdown.split(/\r?\n/).slice(0, 16);
  for (let i = 0; i < opening.length; i++) {
    const match = /⬅️.*?\]\(([^)]+)\).*?➡️.*?\]\(([^)]+)\)/u.exec(opening[i]);
    if (match) return { previous: match[1], next: match[2], line: i + 1 };
  }
  return null;
}

export function checkChapterNavigation(chapters, read) {
  const issues = [];
  for (let index = 0; index < chapters.length; index++) {
    const chapter = chapters[index];
    const nav = readNavigation(read(chapter));
    if (!nav) {
      issues.push(`${chapter}: missing opening previous/next navigation`);
      continue;
    }
    const firstPi = chapter.startsWith('docs/05-raspberry-pi/') &&
      !chapters[index - 1]?.startsWith('docs/05-raspberry-pi/');
    const expected = {
      previous: firstPi ? 'README.md' : chapters[index - 1] || 'docs/00-如何使用本教程.md',
      next: chapters[index + 1] || 'LEARNING_PATHS.md',
    };
    for (const direction of ['previous', 'next']) {
      let target;
      try {
        target = path.posix.normalize(path.posix.join(path.posix.dirname(chapter), decodeURIComponent(nav[direction].split('#')[0])));
      } catch {
        issues.push(`${chapter}:${nav.line}: malformed ${direction} link`);
        continue;
      }
      if (target !== expected[direction]) {
        issues.push(`${chapter}:${nav.line}: ${direction} should link to ${expected[direction]}, got ${target}`);
      }
    }
  }
  return issues;
}
