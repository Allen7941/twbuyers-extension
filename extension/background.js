import { credentialKey, lookup, productPage, readToken } from "./api.js";

const cacheKey = "priceHistoryCache";
const cacheLimit = 24;
const resultLifetime = 5 * 60 * 1000;
const errorLifetime = 20 * 1000;
const pending = new Map();
const cacheReady = chrome.storage.session.get(cacheKey)
  .then(stored => new Map(stored[cacheKey] ?? []))
  .catch(() => new Map());

async function requestKey(pageKey, token) {
  const bytes = new TextEncoder().encode(JSON.stringify([pageKey, token]));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function requestHistory(page, retry = false) {
  const stored = await chrome.storage.local.get(credentialKey);
  const token = readToken(stored[credentialKey]);
  if (!token) return { kind: "missing-token" };

  const key = await requestKey(page.key, token);
  const cache = await cacheReady;
  if (pending.has(key)) return pending.get(key);

  const cached = cache.get(key);
  if (!retry && cached?.expiresAt > Date.now()) return cached.response;

  const request = (async () => {
    let response;
    try {
      response = { kind: "result", history: await lookup(page.url, token) };
    } catch (error) {
      response = { kind: "error", status: error.status, name: error.name };
    }

    const now = Date.now();
    const lifetime = response.kind === "result" ? resultLifetime : errorLifetime;
    for (const [cacheId, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(cacheId);
    }
    cache.delete(key);
    cache.set(key, { response, expiresAt: now + lifetime });
    if (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
    await chrome.storage.session.set({ [cacheKey]: [...cache] }).catch(() => {});
    return response;
  })().finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

function prefetch(tab) {
  if (tab.incognito || tab.status !== "complete") return;
  const page = productPage(tab.url);
  if (page) void requestHistory(page).catch(() => {});
}

chrome.tabs.onUpdated.addListener((_tabId, changes, tab) => {
  if (changes.status === "complete" || changes.url) prefetch(tab);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId).then(prefetch).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "price-history" || sender.url !== chrome.runtime.getURL("popup.html")) return;
  const page = productPage(message.url);
  if (!page) return;

  requestHistory(page, message.retry === true)
    .then(respond, () => respond({ kind: "error" }));
  return true;
});
