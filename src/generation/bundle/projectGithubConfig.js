/**
 * Per-project GitHub repo binding (.xhlp-github.json in project root).
 * Blank repo => auto-create on build. User can edit from Build Settings.
 */
const fs = acode.require('fs');

export const GITHUB_CONFIG_FILE = '.xhlp-github.json';

function joinUri(base, rel) {
  const b = String(base || '').replace(/\/+$/, '');
  const r = String(rel || '').replace(/^\/+/, '');
  if (!r) return b;
  return b + '/' + r;
}

export function makeProjectId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

export function randomRepoSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

/** Sanitize folder name → github repo name fragment */
export function sanitizeRepoName(name) {
  return String(name || 'android-app')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'android-app';
}

export async function readProjectGithubConfig(projectRootUrl) {
  const url = joinUri(projectRootUrl, GITHUB_CONFIG_FILE);
  try {
    const f = fs(url);
    if (f && (await f.exists())) {
      const raw = String(await f.readFile('utf-8'));
      const data = JSON.parse(raw);
      return {
        repo: (data.repo || '').trim(),
        projectId: data.projectId || makeProjectId(),
        branch: (data.branch || '').trim(),
      };
    }
  } catch (e) {
    console.warn('[xhlp-github] read', e);
  }
  return null;
}

export async function writeProjectGithubConfig(projectRootUrl, cfg) {
  const url = joinUri(projectRootUrl, GITHUB_CONFIG_FILE);
  const body = JSON.stringify(
    {
      repo: (cfg.repo || '').trim(),
      projectId: cfg.projectId || makeProjectId(),
      branch: (cfg.branch || '').trim(),
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );
  try {
    const f = fs(url);
    if (f && (await f.exists())) {
      await f.writeFile(body);
    } else {
      const parent = projectRootUrl.replace(/\/+$/, '');
      await fs(parent).createFile(GITHUB_CONFIG_FILE, body);
    }
    return true;
  } catch (e) {
    console.warn('[xhlp-github] write', e);
    return false;
  }
}

/**
 * Ensure config file exists. New projects get blank repo + projectId.
 * Missing file → regenerate.
 */
export async function ensureProjectGithubConfig(projectRootUrl, opts = {}) {
  let cfg = await readProjectGithubConfig(projectRootUrl);
  if (!cfg) {
    cfg = {
      repo: opts.repo != null ? String(opts.repo) : '',
      projectId: opts.projectId || makeProjectId(),
      branch: opts.branch || '',
    };
    await writeProjectGithubConfig(projectRootUrl, cfg);
  }
  return cfg;
}

/** Leaf folder name from project URL */
export function projectLeafName(projectRootUrl) {
  const s = String(projectRootUrl || '')
    .replace(/^file:\/\//, '')
    .replace(/\/+$/, '');
  const parts = s.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'android-app';
}
