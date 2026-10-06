import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

async function checksum(file) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest('hex');
}

function within(root, relative) {
  assert.ok(typeof relative === 'string' && !path.isAbsolute(relative));
  const resolved = path.resolve(root, relative);
  const remainder = path.relative(root, resolved);
  assert.ok(remainder && remainder !== '..' && !remainder.startsWith(`..${path.sep}`) && !path.isAbsolute(remainder));
  return resolved;
}

export async function assembleMedia(directory) {
  const root = await realpath(directory);
  const manifest = JSON.parse(await readFile(path.join(root, 'data/media_manifest.json'), 'utf8'));
  assert.equal(manifest.version, 1);
  const allowed = new Set(['assets/gallery_v29.glb', 'assets/van-gogh-early-years.mp4']);
  assert.equal(manifest.files.length, allowed.size);
  for (const media of manifest.files) {
    assert.ok(allowed.delete(media.path), `Unexpected media target: ${media.path}`);
    assert.match(media.sha256, /^[0-9a-f]{64}$/);
    const target = within(root, media.path);
    let existing;
    try { existing = await stat(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) {
      within(root, path.relative(root, await realpath(target)));
      assert.equal(existing.size, media.bytes, `Existing media size differs: ${media.path}`);
      assert.equal(await checksum(target), media.sha256, `Existing media checksum differs: ${media.path}`);
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    within(root, path.relative(root, await realpath(path.dirname(target))));
    const temporary = within(root, `${media.path}.assembling-${process.pid}`);
    const output = await open(temporary, 'wx');
    let totalBytes = 0;
    const digest = createHash('sha256');
    try {
      for (const part of media.parts) {
        assert.match(part.path, /^assets\/media-parts\/[a-z0-9.-]+\.bin$/);
        const input = within(root, part.path);
        within(root, path.relative(root, await realpath(input)));
        const bytes = await readFile(input);
        assert.equal(bytes.length, part.bytes, `Media part size differs: ${part.path}`);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), part.sha256, `Media part checksum differs: ${part.path}`);
        digest.update(bytes);
        let offset = 0;
        while (offset < bytes.length) {
          const written = await output.write(bytes, offset, bytes.length - offset, totalBytes + offset);
          assert.ok(written.bytesWritten > 0);
          offset += written.bytesWritten;
        }
        totalBytes += bytes.length;
      }
      assert.equal(totalBytes, media.bytes, `Assembled media size differs: ${media.path}`);
      assert.equal(digest.digest('hex'), media.sha256, `Assembled media checksum differs: ${media.path}`);
      await output.close();
      await rename(temporary, target);
      console.log(`Restored ${media.path} byte-for-byte from ${media.parts.length} parts`);
    } finally {
      await output.close();
      await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await assembleMedia(path.dirname(fileURLToPath(import.meta.url)));
}
