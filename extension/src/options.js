import {
  getSettings,
  saveSettings,
  parseKeywordList,
  parseUrlList,
  MIN_INTERVAL_MINUTES
} from './lib/settings.js';
import { clearHistory } from './lib/store.js';

const statusEl = document.getElementById('status');
const fields = {
  enabled: document.getElementById('enabled'),
  keywords: document.getElementById('keywords'),
  matchMode: document.getElementById('matchMode'),
  excludeKeywords: document.getElementById('excludeKeywords'),
  intervalMinutes: document.getElementById('intervalMinutes'),
  maxNotifications: document.getElementById('maxNotifications'),
  customUrls: document.getElementById('customUrls')
};

function say(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}

async function load() {
  const settings = await getSettings();
  fields.enabled.checked = settings.enabled;
  fields.keywords.value = settings.keywords.join(', ');
  fields.matchMode.value = settings.matchMode;
  fields.excludeKeywords.value = (settings.excludeKeywords || []).join(', ');
  fields.intervalMinutes.value = settings.intervalMinutes;
  fields.maxNotifications.value = settings.maxNotifications;
  fields.customUrls.value = (settings.customUrls || []).join('\n');
}

async function save() {
  const keywords = parseKeywordList(fields.keywords.value);
  const customUrls = parseUrlList(fields.customUrls.value);
  if (!keywords.length && !customUrls.length) {
    say('Add at least one keyword, or a custom search URL.', 'err');
    return null;
  }
  const settings = await saveSettings({
    enabled: fields.enabled.checked,
    keywords,
    matchMode: fields.matchMode.value,
    excludeKeywords: parseKeywordList(fields.excludeKeywords.value),
    intervalMinutes: Math.max(
      MIN_INTERVAL_MINUTES,
      Number(fields.intervalMinutes.value) || MIN_INTERVAL_MINUTES
    ),
    maxNotifications: Math.max(1, Number(fields.maxNotifications.value) || 3),
    customUrls
  });
  await chrome.runtime.sendMessage({ type: 'settingsChanged' });
  await load();
  return settings;
}

document.getElementById('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (await save()) say('Saved.', 'ok');
});

document.getElementById('test').addEventListener('click', async () => {
  if (!(await save())) return;
  say('Checking…');
  const result = await chrome.runtime.sendMessage({ type: 'checkNow' });
  if (!result?.ok) {
    say(`Check failed: ${result?.error || 'unknown error'}`, 'err');
    return;
  }
  say(
    result.seeding
      ? `Saved. Baseline recorded from ${result.results} current posts — you'll be notified about new ones from here on.`
      : `Saved. ${result.results} results, ${result.matched} matching your keywords, ${result.fresh} new.`,
    'ok'
  );
});

document.getElementById('reset').addEventListener('click', async () => {
  await clearHistory();
  await saveSettings({ seeded: false });
  say('Cleared. The next check records a fresh baseline instead of notifying.', 'ok');
});

load();
