// Runs only to give the service worker a DOMParser, which MV3 workers lack.
import { parseJobsFromDocument } from './lib/parser.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message.type !== 'parse') return false;
  try {
    const doc = new DOMParser().parseFromString(message.html, 'text/html');
    sendResponse({ ok: true, jobs: parseJobsFromDocument(doc) });
  } catch (error) {
    sendResponse({ ok: false, error: String(error) });
  }
  return true;
});
