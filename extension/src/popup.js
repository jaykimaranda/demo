import { getSettings } from './lib/settings.js';
import { getMatches, getStatus } from './lib/store.js';

const statusEl = document.getElementById('status');
const jobsEl = document.getElementById('jobs');
const emptyEl = document.getElementById('empty');
const checkBtn = document.getElementById('check');

function relativeTime(ts) {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function renderStatus(status) {
  if (!status) {
    statusEl.textContent = 'No check has run yet.';
    statusEl.className = 'status';
    return;
  }
  const when = relativeTime(status.at);
  if (!status.ok) {
    statusEl.textContent = `Last check ${when} failed: ${status.error}`;
    statusEl.className = 'status err';
    return;
  }
  statusEl.textContent = status.seeding
    ? `Baseline recorded ${when} (${status.results} posts). You'll be notified about posts added from now on.`
    : `Checked ${when} — ${status.results} results, ${status.matched} matching, ${status.fresh} new.`;
  statusEl.className = 'status ok';
}

async function renderJobs() {
  const matches = await getMatches();
  jobsEl.innerHTML = '';
  emptyEl.hidden = matches.length > 0;
  for (const job of matches.slice(0, 25)) {
    const li = document.createElement('li');
    if (job.unread) li.className = 'unread';
    const link = document.createElement('a');
    link.href = job.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = job.title;
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = `found ${relativeTime(job.foundAt)}`;
    li.append(link, when);
    jobsEl.append(li);
  }
}

async function render() {
  const settings = await getSettings();
  const keywords = settings.keywords.join(', ') || '(no keyword filter)';
  document.getElementById('watching').textContent = settings.enabled
    ? `Watching every ${settings.intervalMinutes} min for: ${keywords}`
    : 'Watching is turned off — enable it in Settings.';
  renderStatus(await getStatus());
  await renderJobs();
}

checkBtn.addEventListener('click', async () => {
  checkBtn.disabled = true;
  checkBtn.textContent = 'Checking…';
  try {
    renderStatus({ ...(await chrome.runtime.sendMessage({ type: 'checkNow' })), at: Date.now() });
    await renderJobs();
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = 'Check now';
  }
});

document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

render().then(() => {
  // Opening the popup counts as reading the new matches.
  chrome.runtime.sendMessage({ type: 'markRead' });
});
