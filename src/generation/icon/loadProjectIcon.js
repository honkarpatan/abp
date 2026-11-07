/**
 * Load project launcher icon as a valid data URL for <img>.
 * Critical: never read PNG as utf-8 text (corrupts 0x89 → broken base64 like /VBORw…).
 */

function fsApi() {
  try {
    return acode.require('fs') || acode.require('fsOperation');
  } catch (_) {
    try {
      return acode.require('fsOperation');
    } catch (__) {
      return null;
    }
  }
}

function resRoots(projectRoot) {
  const root = String(projectRoot || '').replace(/\/+$/, '');
  const list = [];
  const add = (r) => {
    if (r && !list.includes(r)) list.push(r);
  };
  add(`${root}/src/main/res`);
  add(`${root}/app/src/main/res`);
  if (/\/app$/i.test(root)) {
    add(`${root.replace(/\/app$/i, '')}/app/src/main/res`);
  }
  return list;
}

function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < u8.length; i += step) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + step));
  }
  return btoa(binary);
}

function isPngBytes(u8) {
  return (
    u8 &&
    u8.length >= 8 &&
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47
  );
}

function isWebpBytes(u8) {
  // RIFF....WEBP
  return (
    u8 &&
    u8.length >= 12 &&
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45
  );
}

function normalizeBase64(s) {
  if (!s || typeof s !== 'string') return null;
  let t = s.trim();
  // strip data-url prefix if present
  const m = t.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/s);
  if (m) t = m[1];
  t = t.replace(/\s/g, '');
  // fix common corruption: missing leading "i" on PNG base64
  if (t.startsWith('/VBORw') || t.startsWith('/9j/')) {
    // still likely corrupted UTF-8 read — reject
    return null;
  }
  if (!/^[A-Za-z0-9+/]+=*$/.test(t.slice(0, 64))) return null;
  // PNG base64 must start with iVBOR
  if (t.startsWith('iVBOR') || t.startsWith('/9j/') || t.startsWith('UklGR')) {
    return t;
  }
  // allow other valid-looking base64 of sufficient length
  if (t.length > 64) return t;
  return null;
}

async function readAsUint8Array(fileUrl) {
  const fs = fsApi();
  if (!fs) return null;

  // 1) Preferred: explicit base64 from FS
  try {
    const b64 = await fs(fileUrl).readFile('base64');
    const norm = normalizeBase64(typeof b64 === 'string' ? b64 : null);
    if (norm) {
      const bin = atob(norm);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    }
  } catch (_) {}

  // 2) Raw ArrayBuffer / TypedArray
  try {
    const raw = await fs(fileUrl).readFile();
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    if (ArrayBuffer.isView(raw)) {
      return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    }
    if (raw && raw.buffer instanceof ArrayBuffer) {
      return new Uint8Array(raw.buffer);
    }
  } catch (_) {}

  // 3) Some builds accept empty encoding arg
  try {
    const raw = await fs(fileUrl).readFile('');
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    if (ArrayBuffer.isView(raw)) {
      return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    }
  } catch (_) {}

  return null;
}

async function readBinaryAsDataUrl(fileUrl, mimeHint) {
  const u8 = await readAsUint8Array(fileUrl);
  if (!u8 || !u8.byteLength) return null;

  let mime = mimeHint || 'image/png';
  if (isPngBytes(u8)) mime = 'image/png';
  else if (isWebpBytes(u8)) mime = 'image/webp';
  else if (u8[0] === 0xff && u8[1] === 0xd8) mime = 'image/jpeg';
  else if (mimeHint && mimeHint.includes('png') && !isPngBytes(u8)) {
    // Reject corrupted “png” — would show broken <img>
    console.warn('[icon] not valid PNG bytes:', fileUrl, u8[0], u8[1], u8[2], u8[3]);
    return null;
  }

  const b64 = bytesToBase64(u8);
  if (mime === 'image/png' && !b64.startsWith('iVBOR')) {
    console.warn('[icon] PNG base64 magic mismatch');
    return null;
  }
  return `data:${mime};base64,${b64}`;
}

export async function findLauncherIconUrl(projectRoot) {
  const fs = fsApi();
  if (!fs) return null;

  const densities = [
    'mipmap-xxxhdpi',
    'mipmap-xxhdpi',
    'mipmap-xhdpi',
    'mipmap-hdpi',
    'mipmap-mdpi',
  ];
  const names = ['ic_launcher.png', 'ic_launcher.webp', 'ic_launcher_round.png'];

  for (const resBase of resRoots(projectRoot)) {
    for (const dens of densities) {
      for (const name of names) {
        const url = `${resBase}/${dens}/${name}`;
        try {
          if (!(await fs(url).exists())) continue;
        } catch (_) {
          continue;
        }
        const dataUrl = await readBinaryAsDataUrl(
          url,
          name.endsWith('.webp') ? 'image/webp' : 'image/png'
        );
        if (dataUrl) {
          console.log('[icon] loaded', url, dataUrl.slice(0, 32));
          return { dataUrl, path: url, name };
        }
      }
    }

    // list fallback
    try {
      if (!(await fs(resBase).exists())) continue;
      const entries = await fs(resBase).lsDir();
      const mipmaps = (entries || []).filter((e) => /^mipmap-/i.test(e.name || ''));
      for (const dir of mipmaps) {
        let files = [];
        try {
          files = await fs(dir.url).lsDir();
        } catch (_) {
          continue;
        }
        for (const name of names) {
          const hit = (files || []).find((f) => f.name === name);
          if (!hit) continue;
          const dataUrl = await readBinaryAsDataUrl(
            hit.url,
            /\.webp$/i.test(name) ? 'image/webp' : 'image/png'
          );
          if (dataUrl) return { dataUrl, path: hit.url, name };
        }
      }
    } catch (_) {}
  }
  return null;
}

export function notifyIconUpdated(projectRoot) {
  try {
    window.dispatchEvent(
      new CustomEvent('xhlp-icon-updated', { detail: { projectRoot } })
    );
  } catch (_) {}
}
