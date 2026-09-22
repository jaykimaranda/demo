// Settings shape, defaults and helpers shared by the service worker and the UI pages.

export const SEARCH_URL_TEMPLATE =
  'https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword={keyword}';

export const DEFAULTS = {
  enabled: true,
  // Keywords to watch for. One search request is made per keyword.
  keywords: ['webflow'],
  // 'any'  -> notify when the title contains at least one keyword
  // 'all'  -> notify only when the title contains every keyword
  // 'none' -> notify for every result the search URL returns (no title filter)
  matchMode: 'any',
  // Titles containing any of these are never notified.
  excludeKeywords: [],
  // Minutes between checks. Chrome throttles alarms, so keep this sane.
  intervalMinutes: 15,
  // Leave empty to search each keyword on OnlineJobs.ph. Set custom URLs to
  // watch a saved search / filtered listing instead.
  customUrls: [],
  // How many individual notifications to show before collapsing into one
  // "N new jobs" summary notification.
  maxNotifications: 3,
  // The first check only records what is already posted, so you are not
  // flooded with notifications for jobs that existed before you installed.
  seeded: false
};

export const MIN_INTERVAL_MINUTES = 5;

export async function getSettings() {
  const stored = await chrome.storage.sync.get('settings');
  return { ...DEFAULTS, ...(stored.settings || {}) };
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ settings: next });
  return next;
}

export function parseKeywordList(value) {
  return String(value || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseUrlList(value) {
  return String(value || '')
    .split(/\s*\n\s*/)
    .map((s) => s.trim())
    .filter((s) => /^https:\/\/(www\.)?onlinejobs\.ph\//i.test(s));
}

/** The list of pages a check should fetch, given the current settings. */
export function watchUrls(settings) {
  if (settings.customUrls && settings.customUrls.length) {
    return settings.customUrls.slice();
  }
  const keywords = settings.keywords.length ? settings.keywords : DEFAULTS.keywords;
  return keywords.map((kw) =>
    SEARCH_URL_TEMPLATE.replace('{keyword}', encodeURIComponent(kw))
  );
}

/** True when a job title passes the keyword / exclusion filters. */
export function titleMatches(title, settings) {
  const haystack = String(title || '').toLowerCase();
  const excluded = (settings.excludeKeywords || []).some((kw) =>
    haystack.includes(kw.toLowerCase())
  );
  if (excluded) return false;

  const keywords = settings.keywords || [];
  if (settings.matchMode === 'none' || keywords.length === 0) return true;
  if (settings.matchMode === 'all') {
    return keywords.every((kw) => haystack.includes(kw.toLowerCase()));
  }
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}
