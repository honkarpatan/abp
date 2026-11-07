/**
 * Collect res/values + res/drawable XML + included layouts for external preview.
 * Enables colors, dimen, shape/vector drawables, and <include> without aapt2.
 */
import { collectProjectValues } from './ValuesCollector.js';

const fs = acode.require('fs');

/**
 * @param {string} xmlUri
 * @param {string} [layoutXml]
 * @returns {Promise<{values: object, drawables: Record<string,string>, layouts: Record<string,string>}>}
 */
export async function collectPreviewAssets(xmlUri, layoutXml = '') {
  const values = await collectProjectValues(xmlUri);
  const drawables = await collectDrawableXmls(xmlUri, layoutXml);
  const fonts = await collectFontXmls(xmlUri);
  const layouts = await collectIncludedLayouts(xmlUri, layoutXml);
  const menus = await collectMenus(xmlUri, layoutXml);
  console.log(
    '[XHLP] assets:',
    'str',
    Object.keys(values.strings || {}).length,
    'col',
    Object.keys(values.colors || {}).length,
    'dim',
    Object.keys(values.dimen || {}).length,
    'drw',
    Object.keys(drawables).length,
    'lay',
    Object.keys(layouts).length,
    'menu',
    Object.keys(menus).length
  );
  if (fonts && Object.keys(fonts).length) {
    values.fonts = fonts;
  }
  // Pull drawable refs from included layouts too (message bubbles, etc.)
  try {
    const extra = new Set();
    for (const body of Object.values(layouts || {})) {
      const re = /@drawable\/([a-zA-Z0-9_]+)/g;
      let m;
      while ((m = re.exec(String(body)))) extra.add(m[1] + '.xml');
    }
    if (extra.size) {
      const more = await collectDrawableXmls(xmlUri, [...extra].map((n) => '@drawable/' + n.replace(/\.xml$/, '')).join(' '));
      Object.assign(drawables, more);
    }
  } catch (e) {
    console.warn('[XHLP] drawable pass2', e);
  }
  console.log(
    '[XHLP] FINAL assets drw=',
    Object.keys(drawables).length,
    'lay=',
    Object.keys(layouts).length,
    'sampleDrw=',
    Object.keys(drawables).slice(0, 10).join(',')
  );
  return { values, drawables, layouts, menus };
}

const KNOWN_DRAWABLES = [
  'bg_player_gradient.xml','bg_play_circle.xml','bg_art_rounded.xml','bg_queue_card.xml','bg_chip.xml',
  'album_cover.xml','album_cover_small.xml','progress_seek.xml',
  'ic_play.xml','ic_pause.xml','ic_heart.xml','ic_more.xml','ic_shuffle.xml','ic_repeat.xml',
  'ic_skip_next.xml','ic_skip_prev.xml','ic_home.xml','ic_search.xml','ic_library.xml',
  'bg_chat.xml','bg_message_in.xml','bg_message_out.xml','bg_message_input.xml','bg_send_button.xml',
  'ic_arrow_back.xml','ic_attachment.xml','ic_call.xml','ic_camera.xml','ic_emoji.xml',
  'ic_mic.xml','ic_more_vert.xml','ic_profile_circle.xml','ic_video.xml',
  'ic_menu_camera.xml','ic_menu_gallery.xml','ic_menu_slideshow.xml',
  'ic_launcher_background.xml','ic_launcher_foreground.xml',
];

async function collectDrawableXmls(xmlUri, layoutXml = '') {
  const out = {};
  // 1) Names referenced in the open layout XML
  const fromXml = new Set();
  const re = /@drawable\/([a-zA-Z0-9_]+)/g;
  let mm;
  const src = String(layoutXml || '');
  while ((mm = re.exec(src))) fromXml.add(mm[1] + '.xml');
  // also mipmap treated as drawable xml sometimes
  const reM = /@mipmap\/([a-zA-Z0-9_]+)/g;
  while ((mm = reM.exec(src))) fromXml.add(mm[1] + '.xml');

  const dirs = candidateDrawableDirs(xmlUri);
  for (const dir of dirs) {
    let names = [];
    try {
      const list = await fs(dir).listDir();
      names = (list || [])
        .map((e) => (typeof e === 'string' ? e : e?.name || e?.url || ''))
        .map((n) => String(n).split('/').pop())
        .filter((n) => /\.xml$/i.test(n));
    } catch (_) {
      names = [];
    }
    names = [...new Set([...(names || []), ...KNOWN_DRAWABLES, ...fromXml])];
    for (const name of names) {
      const base = name.replace(/\.xml$/i, '');
      if (out[base]) continue;
      try {
        const text = String(await fs(joinUrl(dir, name)).readFile('utf-8'));
        if (text && text.includes('<')) out[base] = text;
      } catch (_) {}
    }
  }

  // 2) Direct path rewrite from layout URI (most reliable on Acode content://)
  const u = String(xmlUri || '').replace(/\\/g, '/');
  const need = [...new Set([...KNOWN_DRAWABLES, ...fromXml])];
  if (/\/layout\//i.test(u) || /%2[Ff]layout%2[Ff]/i.test(u)) {
    for (const name of need) {
      const base = name.replace(/\.xml$/i, '');
      if (out[base]) continue;
      const candidates = [
        u.replace(/\/layout\/[^/]+$/i, '/drawable/' + name),
        u.replace(/%2[Ff]layout%2[Ff][^/]+$/i, '%2Fdrawable%2F' + name),
        u.replace(/\/layout\/[^/]+$/i, '/drawable-anydpi/' + name),
        u.replace(/\/layout\/[^/]+$/i, '/drawable-hdpi/' + name),
      ];
      for (const fileUrl of candidates) {
        if (fileUrl === u) continue;
        try {
          const text = String(await fs(fileUrl).readFile('utf-8'));
          if (text && text.includes('<')) {
            out[base] = text;
            break;
          }
        } catch (_) {}
      }
    }
  }


  // 3) Binary images (png/webp/jpg) — ONLY layout-referenced names, strict size caps.
  // Avoids the xhlp payload blow-up: no full-folder scan, no large album art.
  const MAX_BMP_B64 = 100000; // ~75KB file
  const MAX_BMP_COUNT = 4;
  let bmpCount = 0;
  const refBases = new Set(
    [...fromXml].map((n) => String(n).replace(/\.xml$/i, ''))
  );
  async function readSmallBitmap(fileUrl, base) {
    if (bmpCount >= MAX_BMP_COUNT) return false;
    if (out[base] && !String(out[base]).startsWith('bitmap:')) {
      // XML already present — only override if user clearly has a small bitmap
      // (same resource name). Keep XML if bitmap too large / missing.
    }
    for (const enc of ['base64', undefined]) {
      try {
        const data =
          enc === 'base64'
            ? await fs(fileUrl).readFile('base64')
            : await fs(fileUrl).readFile();
        if (!data) continue;
        let b64 = '';
        if (typeof data === 'string') {
          if (/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 80)) && data.length > 32) {
            b64 = data.replace(/\s/g, '');
          } else if (typeof btoa === 'function') {
            b64 = btoa(data);
          }
        } else if (data instanceof ArrayBuffer || (data && data.buffer)) {
          const bytes = new Uint8Array(data.buffer || data);
          let s = '';
          const step = 0x8000;
          for (let i = 0; i < bytes.length; i += step) {
            s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
          }
          b64 = btoa(s);
        }
        if (!b64 || b64.length < 32) continue;
        if (b64.length > MAX_BMP_B64) {
          console.warn('[XHLP] skip large bitmap', base, b64.length);
          return false;
        }
        const ext = (fileUrl.match(/\.([a-z0-9]+)$/i) || [, 'png'])[1].toLowerCase();
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
              ? 'image/webp'
              : ext === 'gif'
                ? 'image/gif'
                : 'image/png';
        out[base] = 'bitmap:' + mime + ';base64,' + b64;
        bmpCount++;
        return true;
      } catch (_) {}
    }
    return false;
  }

  const BITMAP_EXT = ['.png', '.webp', '.jpg', '.jpeg'];
  if (refBases.size && (/\/layout\//i.test(u) || /%2[Ff]layout%2[Ff]/i.test(u))) {
    for (const base of refBases) {
      if (bmpCount >= MAX_BMP_COUNT) break;
      // Prefer small bitmap over XML placeholder for same name (album_cover.png vs .xml)
      for (const ext of BITMAP_EXT) {
        const candidates = [
          u.replace(/\/layout\/[^/]+$/i, '/drawable/' + base + ext),
          u.replace(/\/layout\/[^/]+$/i, '/drawable-xxhdpi/' + base + ext),
          u.replace(/\/layout\/[^/]+$/i, '/drawable-xhdpi/' + base + ext),
          u.replace(/\/layout\/[^/]+$/i, '/drawable-hdpi/' + base + ext),
          u.replace(/\/layout\/[^/]+$/i, '/drawable-mdpi/' + base + ext),
        ];
        let ok = false;
        for (const fileUrl of candidates) {
          if (await readSmallBitmap(fileUrl, base)) {
            ok = true;
            break;
          }
        }
        if (ok) break;
      }
    }
  }

  console.log(
    '[XHLP] drawables collected:',
    Object.keys(out).length,
    'bitmaps=',
    bmpCount,
    'fromXmlRefs=',
    fromXml.size,
    'keys=',
    Object.keys(out).slice(0, 15).join(',')
  );
  return out;
}

async function collectIncludedLayouts(xmlUri, layoutXml) {
  const out = {};
  const layoutDirs = candidateLayoutDirs(xmlUri);
  const pending = new Set();
  const seen = new Set();

  function addNamesFrom(text) {
    if (!text) return;
    const re = /layout\s*=\s*"@layout\/([a-zA-Z0-9_]+)"/g;
    let m;
    while ((m = re.exec(text))) pending.add(m[1]);
    const re2 = /tools:listitem\s*=\s*"@layout\/([a-zA-Z0-9_]+)"/g;
    while ((m = re2.exec(text))) pending.add(m[1]);
    const re3 = /@layout\/([a-zA-Z0-9_]+)/g;
    while ((m = re3.exec(text))) pending.add(m[1]);
  }

  addNamesFrom(layoutXml || '');
  // Scaffold / common includes (true/, basic/, MusicPlayer)
  [
    'content_main',
    'app_bar_main',
    'nav_header_main',
    'bottom_nav',
    'item_queue_song',
    'item_queue_song_alt',
    'item_message_in',
    'item_message_out',
  ].forEach((n) => pending.add(n));

  // BFS: load each layout, then scan for nested includes
  let guard = 0;
  while (pending.size > 0 && guard < 40) {
    guard++;
    const name = pending.values().next().value;
    pending.delete(name);
    if (seen.has(name)) continue;
    seen.add(name);

    let body = null;
    for (const dir of layoutDirs) {
      try {
        const fileUrl = joinUrl(dir, name + '.xml');
        const text = String(await fs(fileUrl).readFile('utf-8'));
        if (text && text.includes('<')) {
          body = text;
          break;
        }
      } catch (_) {}
    }
    if (body) {
      out[name] = body;
      // Also try land / sw600dp variants
      for (const q of ['land', 'sw600dp']) {
        for (const dir of layoutDirs) {
          if (!String(dir).includes('layout-' + q)) continue;
          try {
            const text = String(await fs(joinUrl(dir, name + '.xml')).readFile('utf-8'));
            if (text && text.includes('<')) out[name + '@' + q] = text;
          } catch (_) {}
        }
      }
      addNamesFrom(body);
    } else {
      // Direct path rewrite: .../layout/activity_chat.xml → .../layout/item_message_in.xml
      const u = String(xmlUri || '').replace(/\\/g, '/');
      if (/\/layout\//i.test(u)) {
        const fileUrl = u.replace(/\/layout\/[^/]+$/i, '/layout/' + name + '.xml');
        try {
          const text = String(await fs(fileUrl).readFile('utf-8'));
          if (text && text.includes('<')) {
            out[name] = text;
            addNamesFrom(text);
          }
        } catch (_) {}
      }
    }
  }
  console.log('[XHLP] layouts collected:', Object.keys(out).length, Object.keys(out).slice(0, 12).join(','));
  return out;
}


async function collectMenus(xmlUri, layoutXml) {
  const out = {};
  const pending = new Set();
  const text = layoutXml || '';
  const re = /@menu\/([a-zA-Z0-9_]+)/g;
  let m;
  while ((m = re.exec(text))) pending.add(m[1]);
  // common drawer menus
  ['activity_main_drawer', 'main_drawer', 'navigation', 'menu_main'].forEach((n) =>
    pending.add(n)
  );

  const menuDirs = candidateResRoots(xmlUri).map((r) => joinUrl(r, 'menu'));
  for (const name of pending) {
    for (const dir of menuDirs) {
      try {
        const body = String(await fs(joinUrl(dir, name + '.xml')).readFile('utf-8'));
        if (body && body.includes('<menu')) {
          out[name] = body;
          break;
        }
      } catch (_) {}
    }
  }
  // If active file is itself a menu XML, also store under its basename
  try {
    const base = String(xmlUri || '')
      .split('/')
      .pop()
      .replace(/\.xml$/i, '');
    if (text.includes('<menu') && base) {
      out[base] = text;
    }
  } catch (_) {}
  return out;
}

function candidateResRoots(xmlUri) {
  const u = String(xmlUri || '').replace(/\\/g, '/');
  const roots = [];
  const m = u.match(/^(.*\/res)\/layout\//i);
  if (m) roots.push(m[1]);
  let cur = u.replace(/\/[^/]+$/, '');
  if (/\/layout$/i.test(cur)) roots.push(cur.replace(/\/layout$/i, ''));
  for (let i = 0; i < 6; i++) {
    if (/\/res$/i.test(cur)) roots.push(cur);
    const parent = cur.replace(/\/[^/]+$/, '');
    if (!parent || parent === cur) break;
    cur = parent;
  }
  return [...new Set(roots.filter(Boolean))];
}

async function collectFontXmls(xmlUri) {
  const out = {};
  const roots = candidateResRoots(xmlUri);
  for (const r of roots) {
    const dir = joinUrl(r, 'font');
    let names = [];
    try {
      const list = await fs(dir).listDir();
      names = (list || [])
        .map((e) => (typeof e === 'string' ? e : e?.name || ''))
        .map((n) => String(n).split('/').pop())
        .filter((n) => /\.(xml|ttf|otf)$/i.test(n));
    } catch (_) {
      names = ['roboto_regular.ttf', 'roboto_medium.ttf', 'app_font.xml'];
    }
    for (const name of names) {
      const base = name.replace(/\.(xml|ttf|otf)$/i, '');
      if (out[base]) continue;
      try {
        if (/\.xml$/i.test(name)) {
          const text = String(await fs(joinUrl(dir, name)).readFile('utf-8'));
          if (text && text.includes('<')) out[base] = text;
        } else {
          // binary font — mark presence for host fontFamily mapping
          out[base] = 'font-file:' + name;
        }
      } catch (_) {}
    }
  }
  return out;
}

function candidateDrawableDirs(xmlUri) {
  const roots = candidateResRoots(xmlUri);
  // Higher-quality / night first; collector fills missing only
  const buckets = [
    'drawable-night-xxhdpi',
    'drawable-night-xhdpi',
    'drawable-night',
    'drawable-anydpi',
    'drawable-xxhdpi',
    'drawable-xhdpi',
    'drawable-hdpi',
    'drawable-mdpi',
    'drawable',
  ];
  const dirs = [];
  for (const r of roots) {
    for (const b of buckets) dirs.push(joinUrl(r, b));
  }
  return [...new Set(dirs.filter(Boolean))];
}

function candidateLayoutDirs(xmlUri) {
  const roots = candidateResRoots(xmlUri);
  const dirs = [];
  for (const r of roots) {
    // qualified first so they can override when host requests variant via name key
    dirs.push(joinUrl(r, 'layout-land'));
    dirs.push(joinUrl(r, 'layout-sw600dp'));
    dirs.push(joinUrl(r, 'layout'));
  }
  return [...new Set(dirs)];
}

function joinUrl(base, name) {
  return String(base).replace(/\/+$/, '') + '/' + String(name).replace(/^\/+/, '');
}
