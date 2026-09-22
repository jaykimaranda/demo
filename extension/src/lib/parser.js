// Extracts job postings out of an OnlineJobs.ph search results page.
//
// The page is server-rendered HTML and every result links to
// /jobseekers/job/<slug>-<id>, so that link is what we anchor on rather than
// any particular CSS class: classes on the site change far more often than the
// URL shape does. parseJobsFromDocument() is used when a DOM is available
// (offscreen document); parseJobsFromHtml() is a regex fallback for the
// service worker, which has no DOMParser.

const JOB_PATH = /\/jobseekers\/job\/[^"'\s#?]+/i;
const BASE = 'https://www.onlinejobs.ph';

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' '
};

function decodeEntities(text) {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, name) => {
    const key = name.toLowerCase();
    if (ENTITIES[key] !== undefined) return ENTITIES[key];
    if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10));
    return match;
  });
}

function clean(text) {
  return decodeEntities(String(text || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href.split('#')[0];
  return BASE + (href.startsWith('/') ? href : '/' + href).split('#')[0];
}

/** Stable id for a posting: the numeric id at the end of the slug, else the path. */
export function jobIdFromUrl(url) {
  if (!url) return null;
  const path = url.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
  const numeric = path.match(/-(\d+)\/?$/);
  return numeric ? numeric[1] : path;
}

function toJob(href, title) {
  const url = absoluteUrl(href);
  if (!url || !JOB_PATH.test(url)) return null;
  const id = jobIdFromUrl(url);
  if (!id) return null;
  let name = clean(title);
  if (!name) {
    // Fall back to the slug, which reads close enough to the real title.
    const slug = url.split('/jobseekers/job/')[1] || '';
    name = clean(slug.replace(/-\d+$/, '').replace(/-/g, ' '));
  }
  return { id, url, title: name || 'Untitled job post' };
}

function dedupe(jobs) {
  const seen = new Set();
  const out = [];
  for (const job of jobs) {
    if (!job || seen.has(job.id)) continue;
    seen.add(job.id);
    out.push(job);
  }
  return out;
}

/** DOM-based extraction — preferred, because the anchor text is the real title. */
export function parseJobsFromDocument(doc) {
  const anchors = Array.from(doc.querySelectorAll('a[href*="/jobseekers/job/"]'));
  const jobs = anchors.map((a) => {
    const heading = a.querySelector('h1, h2, h3, h4, h5');
    const title = heading ? heading.textContent : a.textContent;
    return toJob(a.getAttribute('href'), title);
  });
  return dedupe(jobs);
}

/** Regex fallback for contexts without a DOM (MV3 service worker). */
export function parseJobsFromHtml(html) {
  const jobs = [];
  const anchor = /<a\b[^>]*href=["']([^"']*\/jobseekers\/job\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchor.exec(html)) !== null) {
    jobs.push(toJob(match[1], match[2]));
  }
  if (jobs.length === 0) {
    // Some markup puts the link on a non-anchor element; take bare paths too.
    const bare = /["'](\/jobseekers\/job\/[^"'\s]+)["']/gi;
    while ((match = bare.exec(html)) !== null) {
      jobs.push(toJob(match[1], ''));
    }
  }
  return dedupe(jobs);
}

/** OnlineJobs.ph redirects logged-out scrapers to a login/verification page. */
export function looksLikeLoginWall(html) {
  const head = html.slice(0, 4000).toLowerCase();
  return (
    /<form[^>]+action=["'][^"']*\/login/i.test(html) ||
    head.includes('please log in') ||
    head.includes('sign in to your account') ||
    head.includes('just a moment') ||
    head.includes('checking your browser')
  );
}
