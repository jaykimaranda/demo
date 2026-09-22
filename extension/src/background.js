// Service worker: polls the OnlineJobs.ph search pages on an alarm, diffs the
// results against what we have already seen, and notifies on anything new.

import {
  getSettings,
  saveSettings,
  watchUrls,
  titleMatches,
  MIN_INTERVAL_MINUTES,
  DEFAULTS
} from './lib/settings.js';
import { parseJobsFromHtml, looksLikeLoginWall } from './lib/parser.js';
import {
  addSeen,
  getSeen,
  addMatches,
  getMatches,
  markAllRead,
  setStatus
} from './lib/store.js';

const ALARM_NAME = 'onlinejobs-check';
const OFFSCREEN_PATH = 'src/offscreen.html';
const NOTIFICATION_PREFIX = 'ojp:';

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await saveSettings(settings);
  await rescheduleAlarm(settings);
  await runCheck('install');
});

chrome.runtime.onStartup.addListener(async () => {
  await rescheduleAlarm(await getSettings());
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) await runCheck('alarm');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'checkNow') {
    runCheck('manual').then(sendResponse);
    return true;
  }
  if (message?.type === 'settingsChanged') {
    getSettings()
      .then(async (settings) => {
        await rescheduleAlarm(settings);
        return { ok: true };
      })
      .then(sendResponse);
    return true;
  }
  if (message?.type === 'markRead') {
    markAllRead()
      .then(() => updateBadge())
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
  const url = notificationId.slice(NOTIFICATION_PREFIX.length);
  await chrome.tabs.create({ url: url || 'https://www.onlinejobs.ph/jobseekers/jobsearch' });
  chrome.notifications.clear(notificationId);
});

async function rescheduleAlarm(settings) {
  await chrome.alarms.clear(ALARM_NAME);
  if (!settings.enabled) return;
  const minutes = Math.max(
    MIN_INTERVAL_MINUTES,
    Number(settings.intervalMinutes) || DEFAULTS.intervalMinutes
  );
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes, delayInMinutes: minutes });
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url]
  });
  if (contexts.length) return true;
  await chrome.offscreen.createDocument({
    url,
    reasons: ['DOM_PARSER'],
    justification: 'Parse OnlineJobs.ph search result HTML into job entries.'
  });
  return true;
}

/** Parse with a real DOM when we can; fall back to the regex parser. */
async function parseHtml(html) {
  try {
    await ensureOffscreen();
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'parse',
      html
    });
    if (response?.ok && Array.isArray(response.jobs)) return response.jobs;
  } catch (error) {
    console.warn('Offscreen parse unavailable, using fallback parser:', error);
  }
  return parseJobsFromHtml(html);
}

async function fetchJobs(url) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'text/html,application/xhtml+xml' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const html = await response.text();
  if (looksLikeLoginWall(html)) {
    throw new Error('OnlineJobs.ph asked for a login — sign in at onlinejobs.ph in this browser, then try again.');
  }
  const jobs = await parseHtml(html);
  if (jobs.length === 0) {
    throw new Error(`No job links found on ${url} — the page layout may have changed.`);
  }
  return jobs;
}

async function runCheck(trigger) {
  const settings = await getSettings();
  if (!settings.enabled && trigger !== 'manual') {
    return { ok: false, error: 'Watching is turned off.' };
  }

  const urls = watchUrls(settings);
  const found = [];
  const errors = [];

  for (const url of urls) {
    try {
      found.push(...(await fetchJobs(url)));
    } catch (error) {
      errors.push(error.message || String(error));
    }
  }

  if (found.length === 0) {
    const status = {
      ok: false,
      trigger,
      error: errors[0] || 'No results returned.',
      errors,
      checked: urls.length
    };
    await setStatus(status);
    return status;
  }

  const matched = found.filter((job) => titleMatches(job.title, settings));
  const seen = await getSeen();
  const fresh = matched.filter((job) => !seen[job.id]);

  // Record every posting we saw, matching or not, so a keyword change later
  // does not replay jobs that were already on the page.
  await addSeen(found.map((job) => job.id));

  let notified = 0;
  if (!settings.seeded) {
    // First run: remember the current page quietly.
    await saveSettings({ seeded: true });
  } else if (fresh.length) {
    await addMatches(fresh);
    notified = await notify(fresh, settings);
    await updateBadge();
  }

  const status = {
    ok: true,
    trigger,
    checked: urls.length,
    results: found.length,
    matched: matched.length,
    fresh: settings.seeded ? fresh.length : 0,
    notified,
    seeding: !settings.seeded,
    errors
  };
  await setStatus(status);
  return status;
}

async function notify(jobs, settings) {
  const max = Math.max(1, Number(settings.maxNotifications) || DEFAULTS.maxNotifications);
  const iconUrl = chrome.runtime.getURL('icons/icon128.png');

  if (jobs.length > max) {
    await createNotification(NOTIFICATION_PREFIX + watchUrls(settings)[0], {
      type: 'basic',
      iconUrl,
      title: `${jobs.length} new OnlineJobs.ph posts`,
      message: jobs
        .slice(0, 5)
        .map((job) => `• ${job.title}`)
        .join('\n'),
      priority: 2
    });
    return 1;
  }

  for (const job of jobs) {
    await createNotification(NOTIFICATION_PREFIX + job.url, {
      type: 'basic',
      iconUrl,
      title: 'New job on OnlineJobs.ph',
      message: job.title,
      contextMessage: 'Click to open the post',
      priority: 2
    });
  }
  return jobs.length;
}

function createNotification(id, options) {
  return new Promise((resolve) => {
    chrome.notifications.create(id, options, () => {
      if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
      resolve();
    });
  });
}

async function updateBadge() {
  const unread = (await getMatches()).filter((job) => job.unread).length;
  await chrome.action.setBadgeText({ text: unread ? String(unread) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
}
