/**
 * Lightweight project values reader for external preview.
 * Prefer direct path substitution (layout → values/strings.xml) so Acode
 * content:// / file:// URIs work without fragile listDir.
 */
const fs = acode.require('fs');

/**
 * @param {string} xmlUri - active layout URI
 * @returns {Promise<{strings: Record<string,string>, colors: Record<string,string>, dimen: Record<string,string>}>}
 */
export async function collectProjectValues(xmlUri) {
  const out = { strings: {}, colors: {}, dimen: {}, styles: {}, bools: {}, integers: {}, arrays: {} };
  const tried = [];
  try {
    const candidates = buildCandidateFiles(xmlUri);
    for (const fileUrl of candidates) {
      tried.push(fileUrl);
      try {
        // Some Acode builds: exists() flaky — just try read
        const text = String(await fs(fileUrl).readFile('utf-8'));
        if (!text || text.length < 8) continue;
        mergeParsed(out, parseValuesXml(text));
      } catch (_) {
        /* try next */
      }
    }

    // Fallback: listDir on values/ if still empty
    if (!Object.keys(out.strings).length) {
      for (const valuesDir of candidateValuesDirs(xmlUri)) {
        try {
          const list = await fs(valuesDir).listDir();
          const names = (list || [])
            .map((e) => {
              if (typeof e === 'string') return e;
              return e?.name || e?.url || e?.path || '';
            })
            .filter((n) => /\.xml$/i.test(String(n)));
          for (const name of names) {
            const base = String(name).split('/').pop();
            const fileUrl = joinUrl(valuesDir, base);
            try {
              const text = String(await fs(fileUrl).readFile('utf-8'));
              mergeParsed(out, parseValuesXml(text));
            } catch (_) {}
          }
        } catch (_) {}
        if (Object.keys(out.strings).length) break;
      }
    }
  } catch (e) {
    console.warn('[XHLP] collectProjectValues', e);
  }


  // values-night overlays (host may prefer based on night mode)
  try {
    for (const res of candidateResRoots(xmlUri)) {
      for (const n of ['colors.xml', 'styles.xml', 'themes.xml', 'strings.xml', 'dimens.xml']) {
        try {
          const text = String(await fs(joinUrl(res, 'values-night/' + n)).readFile('utf-8'));
          if (text && text.length > 8) {
            const night = parseValuesXml(text);
            // mark night keys so host can merge; for now overlay colors/styles
            Object.assign(out.colors, night.colors);
            Object.assign(out.styles, night.styles);
            Object.assign(out.strings, night.strings);
            Object.assign(out.dimen, night.dimen);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  console.log(
    '[XHLP] values:',
    'strings=',
    Object.keys(out.strings).length,
    'colors=',
    Object.keys(out.colors).length,
    'styles=',
    Object.keys(out.styles).length,
    'tried=',
    tried.slice(0, 6)
  );
  return out;
}

/** Fixed files first — most reliable on Acode. */
function buildCandidateFiles(xmlUri) {
  const u = String(xmlUri || '').replace(/\\/g, '/');
  const files = [];
  const resRoots = candidateResRoots(u);
  const names = [
    'strings.xml',
    'colors.xml',
    'dimens.xml',
    'dimen.xml',
    'values.xml',
    'strings_app.xml',
    'styles.xml',
    'themes.xml',
  ];
  for (const res of resRoots) {
    for (const n of names) {
      files.push(joinUrl(res, 'values/' + n));
      files.push(joinUrl(res, 'values-night/' + n));
      files.push(joinUrl(res, 'values-v21/' + n));
      files.push(joinUrl(res, 'values-v23/' + n));
    }
  }
  // Direct replace: .../res/layout/foo.xml → .../res/values/strings.xml
  const direct = u.replace(/\/layout\/[^/]+\.xml$/i, '/values/strings.xml');
  if (direct !== u) {
    files.unshift(direct);
    files.unshift(u.replace(/\/layout\/[^/]+\.xml$/i, '/values/colors.xml'));
    files.unshift(u.replace(/\/layout\/[^/]+\.xml$/i, '/values/dimens.xml'));
    files.unshift(u.replace(/\/layout\/[^/]+\.xml$/i, '/values/styles.xml'));
  }
  return [...new Set(files)];
}

function candidateValuesDirs(xmlUri) {
  return candidateResRoots(xmlUri).map((r) => joinUrl(r, 'values'));
}

function candidateResRoots(xmlUri) {
  const u = String(xmlUri || '').replace(/\\/g, '/');
  const roots = [];
  const m = u.match(/^(.*\/res)\/layout\//i);
  if (m) roots.push(m[1]);
  // content URIs sometimes encode path differently
  const mEnc = u.match(/^(.*\/res)%2[Ff]layout%2[Ff]/i);
  if (mEnc) roots.push(decodeURIComponent(mEnc[1]));
  const m2 = u.match(/^(.*\/src\/main)\/res\/layout\//i);
  if (m2) roots.push(m2[1] + '/res');
  // walk up from layout folder
  let cur = u.replace(/\/[^/]+$/, ''); // drop file
  if (/\/layout$/i.test(cur)) {
    roots.push(cur.replace(/\/layout$/i, ''));
  }
  for (let i = 0; i < 5; i++) {
    if (/\/res$/i.test(cur)) roots.push(cur);
    const parent = cur.replace(/\/[^/]+$/, '');
    if (!parent || parent === cur) break;
    cur = parent;
  }
  return [...new Set(roots.filter(Boolean))];
}

function parseValuesXml(text) {
  const strings = {};
  const colors = {};
  const dimen = {};
  const styles = {};
  const bools = {};
  const integers = {};
  const arrays = {};
  if (!text) return { strings, colors, dimen, styles, bools, integers, arrays };

  // Skip resources marked translatable="false" still OK to include

  // <string name="x">value</string>
  const reStr =
    /<string\b([^>]*)>([\s\S]*?)<\/string>|<string\b([^>]*)\/>/gi;
  let m;
  while ((m = reStr.exec(text))) {
    const attr = m[1] || m[3] || '';
    const nameM = attr.match(/\bname\s*=\s*"([^"]+)"/i);
    if (!nameM) continue;
    const name = nameM[1];
    let val = m[2] != null ? m[2] : '';
    val = val
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .trim();
    if (name) strings[name] = val;
  }

  const reColor =
    /<color\b[^>]*\bname\s*=\s*"([^"]+)"[^>]*>([^<]*)<\/color>/gi;
  while ((m = reColor.exec(text))) {
    const name = m[1];
    const val = String(m[2] || '').trim();
    if (name && val) colors[name] = val;
  }

  const reDimen =
    /<dimen\b[^>]*\bname\s*=\s*"([^"]+)"[^>]*>([^<]*)<\/dimen>/gi;
  while ((m = reDimen.exec(text))) {
    const name = m[1];
    const val = String(m[2] || '').trim();
    if (name && val) dimen[name] = val;
  }

  // <style name="X" parent="Y"> <item name="android:textSize">16sp</item>
  const reStyle = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
  while ((m = reStyle.exec(text))) {
    const attr = m[1] || '';
    const body = m[2] || '';
    const nameM = attr.match(/\bname\s*=\s*"([^"]+)"/i);
    if (!nameM) continue;
    const name = nameM[1];
    const parentM = attr.match(/\bparent\s*=\s*"([^"]+)"/i);
    const st = {};
    if (parentM) st.parent = parentM[1];
    const reItem = /<item\b[^>]*\bname\s*=\s*"([^"]+)"[^>]*>([^<]*)<\/item>/gi;
    let im;
    while ((im = reItem.exec(body))) {
      const ik = im[1];
      const iv = String(im[2] || '').trim();
      if (ik) st[ik] = iv;
    }
    styles[name] = st;
  }

  const reBool = /<bool\b[^>]*\bname\s*=\s*"([^"]+)"[^>]*>([^<]*)<\/bool>/gi;
  while ((m = reBool.exec(text))) {
    bools[m[1]] = String(m[2] || '').trim();
  }
  const reInt = /<integer\b[^>]*\bname\s*=\s*"([^"]+)"[^>]*>([^<]*)<\/integer>/gi;
  while ((m = reInt.exec(text))) {
    integers[m[1]] = String(m[2] || '').trim();
  }
  const reArr = /<string-array\b[^>]*\bname\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/string-array>/gi;
  while ((m = reArr.exec(text))) {
    const items = [];
    const reItem = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let im;
    while ((im = reItem.exec(m[2] || ''))) {
      items.push(String(im[1] || '').replace(/<[^>]+>/g, '').trim());
    }
    arrays[m[1]] = items.join('\u0001');
  }

  return { strings, colors, dimen, styles, bools, integers, arrays };
}

function mergeParsed(out, part) {
  Object.assign(out.strings, part.strings);
  Object.assign(out.colors, part.colors);
  Object.assign(out.dimen, part.dimen);
  if (part.styles) Object.assign(out.styles, part.styles);
  if (part.bools) Object.assign(out.bools, part.bools);
  if (part.integers) Object.assign(out.integers, part.integers);
  if (part.arrays) Object.assign(out.arrays, part.arrays);
}

function joinUrl(base, name) {
  const b = String(base).replace(/\/+$/, '');
  const n = String(name).replace(/^\/+/, '');
  return `${b}/${n}`;
}
