const endpoint = "https://api.twbuyers.info/search-v2";
export const credentialKey = "apiCredentials";
const platforms = new Map([
  ["https://24h.pchome.com.tw", "PChome 24h 購物"],
  ["https://www.momoshop.com.tw", "momo 購物網"],
  ["https://tw.buy.yahoo.com", "Yahoo 購物中心"],
]);

function shoppingPage(value) {
  try {
    const url = new URL(value);
    const platform = platforms.get(url.origin);
    if (!platform || url.username || url.password) return null;
    return { url: url.href, platform };
  } catch {
    return null;
  }
}

export function normalizeToken(value) {
  const token = value?.trim();
  return token && /^[A-Za-z0-9._~+/-]+=*$/.test(token) ? token : "";
}

export function readToken(stored) {
  if (typeof stored === "string") return normalizeToken(stored);
  if (stored?.name?.toLowerCase() !== "authorization") return "";
  return normalizeToken(stored.value?.match(/^Bearer\s+(.+)$/i)?.[1]);
}

export function productPage(value) {
  const page = shoppingPage(value);
  if (!page) return null;

  const url = new URL(page.url);
  let productId;
  switch (url.hostname) {
    case "24h.pchome.com.tw":
      productId = url.pathname.match(/^\/prod\/([a-z0-9-]+)\/?$/i)?.[1];
      break;
    case "www.momoshop.com.tw":
      productId = url.pathname.match(/^\/product\/(\d+)\/?$/)?.[1];
      if (/^\/goods\/GoodsDetail\.jsp$/i.test(url.pathname)) {
        const code = url.searchParams.get("i_code");
        if (/^\d+$/.test(code ?? "")) productId = code;
      }
      break;
    case "tw.buy.yahoo.com":
      productId = url.pathname.match(/^\/gdsale\/(?:[^/]+-)?(\d+)\.html$/i)?.[1];
      break;
  }
  if (!productId) return null;

  const momoCode = url.hostname === "www.momoshop.com.tw" && url.searchParams.get("i_code");
  url.search = "";
  url.hash = "";
  if (momoCode && /^\/goods\/GoodsDetail\.jsp$/i.test(url.pathname)) {
    url.searchParams.set("i_code", productId);
  }
  return { url: url.href, key: `${url.origin}/${productId}`, platform: page.platform };
}

export class ApiError extends Error {
  constructor(status) {
    super(`TWBuyers HTTP ${status}`);
    this.status = status;
  }
}

export async function lookup(url, token) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url, months: 12 }),
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ApiError(response.status);
  if (response.status === 204) return null;
  return parseResult(await response.json());
}

function parseResult(data) {
  if (data === null || (data && Object.keys(data).length === 0 && !Array.isArray(data))) return null;
  if (!Array.isArray(data?.prices)) throw new Error("Unexpected TWBuyers response");

  const prices = [];
  for (const entry of data.prices) {
    if (!Array.isArray(entry)) continue;
    const [price, date] = entry;
    if (!Number.isFinite(price) || price < 0 || typeof date !== "string") continue;
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) continue;
    const timestamp = Date.parse(date.replace(" ", "T") + "Z");
    if (Number.isFinite(timestamp)) prices.push({ price, date, timestamp });
  }
  if (!prices.length) {
    if (data.prices.length) throw new Error("Invalid TWBuyers price records");
    return null;
  }

  prices.sort((first, second) => first.timestamp - second.timestamp);
  const latest = prices.at(-1);
  const lowest = prices.reduce((best, entry) => entry.price <= best.price ? entry : best);
  return {
    name: typeof data.name === "string" ? data.name.trim() : "",
    image: secureImage(data.pic_url),
    prices,
    latest,
    lowest,
  };
}

function secureImage(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}
