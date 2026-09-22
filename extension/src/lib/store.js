// Local state: which postings we have already seen, the recent matches shown in
// the popup, and the outcome of the last check.

const SEEN_KEY = 'seenJobIds';
const MATCH_KEY = 'recentMatches';
const STATUS_KEY = 'lastStatus';

const MAX_SEEN = 3000;
const MAX_MATCHES = 60;

export async function getSeen() {
  const stored = await chrome.storage.local.get(SEEN_KEY);
  return stored[SEEN_KEY] || {};
}

export async function addSeen(ids) {
  const seen = await getSeen();
  const now = Date.now();
  for (const id of ids) {
    if (!seen[id]) seen[id] = now;
  }
  const entries = Object.entries(seen);
  if (entries.length > MAX_SEEN) {
    entries.sort((a, b) => b[1] - a[1]);
    await chrome.storage.local.set({
      [SEEN_KEY]: Object.fromEntries(entries.slice(0, MAX_SEEN))
    });
    return;
  }
  await chrome.storage.local.set({ [SEEN_KEY]: seen });
}

export async function getMatches() {
  const stored = await chrome.storage.local.get(MATCH_KEY);
  return stored[MATCH_KEY] || [];
}

export async function addMatches(jobs) {
  const existing = await getMatches();
  const known = new Set(existing.map((job) => job.id));
  const fresh = jobs
    .filter((job) => !known.has(job.id))
    .map((job) => ({ ...job, foundAt: Date.now(), unread: true }));
  const next = [...fresh, ...existing].slice(0, MAX_MATCHES);
  await chrome.storage.local.set({ [MATCH_KEY]: next });
  return next;
}

export async function markAllRead() {
  const matches = (await getMatches()).map((job) => ({ ...job, unread: false }));
  await chrome.storage.local.set({ [MATCH_KEY]: matches });
  return matches;
}

export async function clearHistory() {
  await chrome.storage.local.remove([SEEN_KEY, MATCH_KEY]);
}

export async function getStatus() {
  const stored = await chrome.storage.local.get(STATUS_KEY);
  return stored[STATUS_KEY] || null;
}

export async function setStatus(status) {
  await chrome.storage.local.set({ [STATUS_KEY]: { ...status, at: Date.now() } });
}
