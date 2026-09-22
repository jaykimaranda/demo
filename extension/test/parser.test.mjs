// Plain-node checks for the pieces that do not need the chrome APIs.
// Run with: node test/parser.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseJobsFromHtml,
  parseJobsFromDocument,
  jobIdFromUrl,
  looksLikeLoginWall
} from '../src/lib/parser.js';
import { titleMatches, watchUrls, parseUrlList, DEFAULTS } from '../src/lib/settings.js';

const html = readFileSync(new URL('./sample-results.html', import.meta.url), 'utf8');
const jobs = parseJobsFromHtml(html);

assert.equal(jobs.length, 4, 'four unique job posts, duplicates and non-job links dropped');
assert.deepEqual(
  jobs.map((j) => j.id),
  ['1234567', '7654321', '5551212', '9999999']
);
assert.equal(jobs[0].title, 'Webflow Developer Needed ASAP');
assert.equal(jobs[0].url, 'https://www.onlinejobs.ph/jobseekers/job/Webflow-Developer-Needed-ASAP-1234567');
assert.equal(jobs[1].title, 'Senior Webflow & Figma Designer', 'entities decoded');

assert.equal(jobIdFromUrl('https://www.onlinejobs.ph/jobseekers/job/Foo-Bar-42'), '42');
assert.equal(jobIdFromUrl('/jobseekers/job/no-numeric-id'), '/jobseekers/job/no-numeric-id');

// Keyword filtering.
const base = { ...DEFAULTS, keywords: ['webflow'] };
const matched = jobs.filter((j) => titleMatches(j.title, base));
assert.deepEqual(matched.map((j) => j.id), ['1234567', '7654321', '9999999']);

const withExclusion = { ...base, excludeKeywords: ['unpaid'] };
assert.deepEqual(
  jobs.filter((j) => titleMatches(j.title, withExclusion)).map((j) => j.id),
  ['1234567', '7654321']
);

const allMode = { ...base, keywords: ['webflow', 'designer'], matchMode: 'all' };
assert.deepEqual(jobs.filter((j) => titleMatches(j.title, allMode)).map((j) => j.id), ['7654321']);

const noFilter = { ...base, matchMode: 'none' };
assert.equal(jobs.filter((j) => titleMatches(j.title, noFilter)).length, 4);

// URLs.
assert.deepEqual(watchUrls({ ...DEFAULTS, keywords: ['webflow developer'] }), [
  'https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=webflow%20developer'
]);
assert.deepEqual(watchUrls({ ...DEFAULTS, customUrls: ['https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=x'] }), [
  'https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=x'
]);
assert.deepEqual(
  parseUrlList('https://www.onlinejobs.ph/jobseekers/jobsearch?a=1\nhttps://example.com/evil\n'),
  ['https://www.onlinejobs.ph/jobseekers/jobsearch?a=1'],
  'only onlinejobs.ph URLs are accepted'
);

// DOM path: stand-in document with just the API parseJobsFromDocument uses.
function fakeAnchor(href, text, headingText) {
  return {
    getAttribute: () => href,
    textContent: text,
    querySelector: () => (headingText ? { textContent: headingText } : null)
  };
}
const fakeDoc = {
  querySelectorAll: () => [
    fakeAnchor('/jobseekers/job/Webflow-Developer-1234567', '\n  ', 'Webflow Developer'),
    fakeAnchor('/jobseekers/job/Webflow-Developer-1234567', 'dupe', null),
    fakeAnchor('/jobseekers/job/Untitled-Slug-Only-222', '   ', null)
  ]
};
const domJobs = parseJobsFromDocument(fakeDoc);
assert.deepEqual(domJobs.map((j) => [j.id, j.title]), [
  ['1234567', 'Webflow Developer'],
  ['222', 'Untitled Slug Only']
], 'heading wins over anchor text; empty titles fall back to the slug');

assert.equal(looksLikeLoginWall('<html><body><form action="/login" method="post">'), true);
assert.equal(looksLikeLoginWall(html), false);

console.log('All parser/settings checks passed.');
