// End-to-end check of the service worker's check → diff → notify flow, against
// an in-memory stand-in for the chrome APIs and a stubbed fetch.
// Run with: node test/background.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseHtml = readFileSync(new URL('./sample-results.html', import.meta.url), 'utf8');
const newPostHtml = baseHtml.replace(
  '</body>',
  '<a href="/jobseekers/job/Webflow-Landing-Page-Build-8888888">Webflow Landing Page Build</a></body>'
);

const sync = {};
const local = {};
const notifications = [];
let alarms = [];
let served = baseHtml;
const listeners = { message: [] };

function area(bag) {
  return {
    async get(key) {
      if (key === null || key === undefined) return { ...bag };
      const keys = Array.isArray(key) ? key : [key];
      return Object.fromEntries(keys.filter((k) => k in bag).map((k) => [k, bag[k]]));
    },
    async set(items) {
      Object.assign(bag, items);
    },
    async remove(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete bag[k];
    }
  };
}

globalThis.chrome = {
  runtime: {
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener: (fn) => listeners.message.push(fn) },
    getURL: (path) => `chrome-extension://test/${path}`,
    getContexts: async () => [],
    // Force the regex fallback path: no offscreen document available.
    sendMessage: async () => {
      throw new Error('no offscreen document in this test');
    },
    lastError: null
  },
  storage: { sync: area(sync), local: area(local) },
  alarms: {
    onAlarm: { addListener() {} },
    async clear() {
      alarms = [];
    },
    create(name, opts) {
      alarms.push({ name, ...opts });
    }
  },
  notifications: {
    onClicked: { addListener() {} },
    create(id, options, cb) {
      notifications.push({ id, ...options });
      cb();
    },
    clear() {}
  },
  action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
  offscreen: {
    async createDocument() {
      throw new Error('offscreen unavailable');
    }
  },
  tabs: { async create() {} }
};

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => served
});

await import('../src/background.js');

function checkNow() {
  return new Promise((resolve) => {
    for (const fn of listeners.message) {
      if (fn({ type: 'checkNow' }, {}, resolve)) return;
    }
  });
}

// First check: baseline only, no notifications.
const first = await checkNow();
assert.equal(first.ok, true);
assert.equal(first.seeding, true, 'first check seeds instead of notifying');
assert.equal(first.results, 4);
assert.equal(notifications.length, 0, 'no notifications on the seeding run');

// Same page again: nothing new.
const second = await checkNow();
assert.equal(second.seeding, false);
assert.equal(second.fresh, 0);
assert.equal(notifications.length, 0);

// A new Webflow post appears.
served = newPostHtml;
const third = await checkNow();
assert.equal(third.fresh, 1, 'only the new post counts as fresh');
assert.equal(third.notified, 1);
assert.equal(notifications.length, 1);
assert.equal(notifications[0].message, 'Webflow Landing Page Build');
assert.equal(
  notifications[0].id,
  'ojp:https://www.onlinejobs.ph/jobseekers/job/Webflow-Landing-Page-Build-8888888',
  'notification id carries the URL so a click can open it'
);
assert.equal(local.recentMatches.length, 1);
assert.equal(local.recentMatches[0].unread, true);

// And it is not re-announced on the next run.
const fourth = await checkNow();
assert.equal(fourth.fresh, 0);
assert.equal(notifications.length, 1);

// A failing fetch surfaces as an error status rather than a silent zero.
globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => '' });
const failed = await checkNow();
assert.equal(failed.ok, false);
assert.match(failed.error, /HTTP 503/);

// A login wall is reported clearly.
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => '<html><body><form action="/login" method="post"></form></body></html>'
});
const walled = await checkNow();
assert.equal(walled.ok, false);
assert.match(walled.error, /login/i);

console.log('All background flow checks passed.');
