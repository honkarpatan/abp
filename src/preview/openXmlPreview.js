/**
 * Routes XML layout preview based on plugin setting:
 *   - html     → legacy in-plugin LayoutPreviewUI (XML → HTML)
 *   - external → connect Host → push layout XML (fast) → optional aapt2 package
 *
 * Protocol: docs/PREVIEW_PROTOCOL.md
 */
import { getSettings } from '../services/settings.js';
import { LayoutPreviewUI } from './ui/LayoutPreviewUI.js';
import { getPreviewHostClient } from './external/PreviewHostClient.js';
import { DEFAULT_PORT } from './external/protocol.js';
import { compileResourcesForPreview } from './external/ResourceCompiler.js';
import { collectPreviewAssets } from './external/AssetCollector.js';
import { DeviceConfig } from './device/DeviceConfig.js';

const fs = acode.require('fs');

/** Monotonic generation — each Preview click bumps this so stale aapt2 cannot overwrite. */
let _gen = 0;
/** Only blocks concurrent aapt2 compiles, not fast XML re-preview. */
let _aaptBusy = false;

/**
 * Open layout preview for the active XML file (or toast if not XML).
 */
export function openXmlPreview() {
  const mode = (getSettings().xmlPreviewMode || 'html').toLowerCase();

  if (mode === 'external') {
    openExternalPreviewer();
    return;
  }

  new LayoutPreviewUI().show();
}

async function openExternalPreviewer() {
  const activeFile = editorManager?.activeFile;
  const uri = activeFile ? String(activeFile.uri || '') : '';
  if (!activeFile || !uri.endsWith('.xml')) {
    window.toast('❌ Please open an XML layout file', 2000);
    return;
  }

  const settings = getSettings();
  const port = Number(settings.externalPreviewPort) || DEFAULT_PORT;
  const client = getPreviewHostClient();
  const layout = layoutNameFromUri(uri);
  const myGen = ++_gen;

  const config = {
    widthDp: DeviceConfig.width || 360,
    heightDp: DeviceConfig.height || 800,
    densityDpi: Math.round(160 * (DeviceConfig.density || 1) * 2.625) || 420,
    orientation: 'portrait',
    nightMode: false,
    locale: 'en',
    api: 34,
  };

  try {
    window.toast(`📡 Connecting to Preview Host :${port}…`, 1200);
    const welcome = await client.ensureConnected();
    if (myGen !== _gen) return;

    const server = welcome?.server || 'host';
    window.toast(`✅ Connected to ${server}`, 1000);

    // --- Read layout XML ---
    let layoutXml = '';
    try {
      if (typeof activeFile.session?.getValue === 'function') {
        layoutXml = activeFile.session.getValue();
      } else if (typeof activeFile.content === 'string') {
        layoutXml = activeFile.content;
      }
      if (!layoutXml && uri) {
        layoutXml = await fs(uri).readFile('utf-8');
      }
    } catch (e) {
      console.warn('[XHLP] read layout xml', e);
    }

    // --- Lightweight values (strings/colors) so @string works without aapt2 ---
    let values = { strings: {}, colors: {}, dimen: {} };
    let drawables = {};
    let layouts = {};
    let menus = {};
    try {
      const assets = await collectPreviewAssets(uri, layoutXml);
      values = assets.values || values;
      drawables = assets.drawables || {};
      layouts = assets.layouts || {};
      menus = assets.menus || {};
      const ns = Object.keys(values.strings || {}).length;
      const nc = Object.keys(values.colors || {}).length;
      const nd = Object.keys(drawables).length;
      const nl = Object.keys(layouts).length;
      const nm = Object.keys(menus).length;
      const msg =
        nd === 0
          ? `⚠️ assets: 0 drawables (icons/shapes will be blank) · ${nl}lay`
          : `📦 ${ns}str ${nc}col ${nd}drw ${nl}lay ${nm}menu`;
      window.toast(msg, nd === 0 ? 4000 : 2000);
      console.log('[XHLP] asset summary', { ns, nc, nd, nl, nm, drwKeys: Object.keys(drawables).slice(0, 20) });
    } catch (e) {
      console.warn('[XHLP] asset collect', e);
      window.toast('⚠️ asset collect failed', 2000);
    }

    if (myGen !== _gen) return;

    if (layoutXml && layoutXml.includes('<')) {
      window.toast(`🖼️ Updating preview: ${layout}…`, 1200);
      try {
        await client.inflate({
          layout,
          layoutResName: `layout/${layout}`,
          layoutXml,
          values,
          drawables,
          layouts,
          menus,
          config,
        });
        if (myGen === _gen) {
          window.toast(`✅ Preview updated: ${layout}`, 2000);
        }
      } catch (infErr) {
        window.toast(`⚠️ XML inflate: ${infErr?.message || infErr}`, 3500);
      }
    } else {
      window.toast('⚠️ Could not read layout XML from editor', 2500);
    }

    // --- Optional aapt2 in background ---
    if (_aaptBusy) return;
    _aaptBusy = true;
    const aaptGen = myGen;
    (async () => {
      try {
        const result = await compileResourcesForPreview(uri, (msg) => {
          if (aaptGen === _gen) window.toast(`🔧 ${msg}`, 1500);
        });
        if (aaptGen !== _gen) return;
        window.toast(`📤 Pushing resources (${result.bytes.byteLength} B)…`, 1500);
        await client.pushResources({
          bytes: result.bytes,
          packageName: result.packageName,
          projectId: result.projectId,
          format: 'aapt2-apk',
        });
        if (aaptGen !== _gen) return;
        // Package inflate (no layoutXml) — real @refs + include
        await client.inflate({
          layout: result.layout || layout,
          layoutResName: `layout/${result.layout || layout}`,
          projectId: result.projectId,
          config,
        });
        if (aaptGen === _gen) {
          window.toast(`✅ Preview: ${result.layout || layout} (aapt2)`, 2500);
        }
      } catch (aaptErr) {
        console.warn('[XHLP] aapt2 path skipped:', aaptErr);
        // Always surface aapt2 failure once (values path still active)
        if (aaptGen === _gen) {
          window.toast(
            `ℹ️ aapt2 skipped: ${aaptErr?.message || aaptErr}`,
            4000
          );
        }
      } finally {
        _aaptBusy = false;
      }
    })();
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('[XHLP external preview]', e);
    if (myGen === _gen) {
      window.toast(`❌ Preview failed: ${msg}`, 5000);
    }
  }
}

function layoutNameFromUri(uri) {
  const base = String(uri).split('/').pop() || '';
  return base.replace(/\.xml$/i, '') || 'unknown';
}
