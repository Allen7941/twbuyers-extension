import { credentialKey, normalizeToken, productPage, readToken } from "./api.js";
import { attachChartHover, drawChart, formatDate, formatPrice } from "./chart.js";

const element = id => document.getElementById(id);
const settings = element("settings");
const settingsToggle = element("settings-toggle");
const settingsMessage = element("settings-message");
const clearSettings = element("clear-settings");
const state = element("state");
const stateAction = element("state-action");
const result = element("result");
const chart = element("chart");
const setChartPlot = attachChartHover(
  chart, element("chart-guide"), element("chart-tooltip"),
  element("chart-tooltip-date"), element("chart-tooltip-price"),
);
const image = element("product-image");

let token = "";
let shopping;
let priceHistory;
let busy = false;
let saving = false;
let stateHandler;
let requestId = 0;

function updateView() {
  const settingsOpen = !settings.hidden;
  settingsToggle.setAttribute("aria-expanded", String(settingsOpen));
  settingsToggle.textContent = settingsOpen ? "返回查詢" : "API 設定";
  state.hidden = settingsOpen || Boolean(priceHistory);
  result.hidden = settingsOpen || !priceHistory;
  setChartPlot(result.hidden ? undefined : drawChart(chart, priceHistory));
}

function showState(title, message = "", action = "", handler = null) {
  priceHistory = null;
  element("state-title").textContent = title;
  element("state-message").textContent = message;
  element("state-message").hidden = !message;
  element("spinner").hidden = !busy;
  stateAction.textContent = action;
  stateAction.hidden = !action;
  stateHandler = handler;
  updateView();
}

function showSettingsMessage(message = "") {
  settingsMessage.textContent = message;
  settingsMessage.hidden = !message;
}

function toggleSettings() {
  if (saving) return;
  if (settings.hidden) {
    settings.elements.apiToken.value = token;
    clearSettings.hidden = !token;
    showSettingsMessage();
    settings.hidden = false;
    settings.elements.apiToken.focus();
  } else {
    settings.hidden = true;
    settings.elements.apiToken.value = "";
    settingsToggle.focus();
  }
  updateView();
}

async function saveSettings(remove = false) {
  if (saving) return;
  const nextToken = normalizeToken(settings.elements.apiToken.value);
  if (!remove && !nextToken) {
    showSettingsMessage("請貼上 Token 本身。若有 Bearer 前綴，請先移除。");
    return;
  }

  saving = true;
  settingsToggle.disabled = true;
  const buttons = Array.from(settings.querySelectorAll("button"));
  buttons.forEach(button => { button.disabled = true; });
  try {
    if (remove) {
      await chrome.storage.local.remove(credentialKey);
      token = "";
    } else {
      await chrome.storage.local.set({ [credentialKey]: nextToken });
      token = nextToken;
    }
  } catch {
    showSettingsMessage("無法儲存 API 設定，請再試一次。");
    return;
  } finally {
    saving = false;
    settingsToggle.disabled = false;
    buttons.forEach(button => { button.disabled = false; });
  }
  toggleSettings();
  void search();
}

function renderResult(history) {
  priceHistory = history;
  const { latest, lowest, prices } = history;
  element("platform").textContent = shopping.platform;
  element("product-name").textContent = history.name || "商品歷史價格";
  image.hidden = true;
  image.removeAttribute("src");
  if (history.image) image.src = history.image;

  element("latest-price").textContent = formatPrice(latest.price);
  element("lowest-price").textContent = formatPrice(lowest.price);
  element("latest-date").textContent = formatDate(latest.date);
  element("lowest-date").textContent = formatDate(lowest.date);

  const difference = latest.price - lowest.price;
  element("price-indicator").textContent = difference
    ? `較最低價高 ${formatPrice(difference)}`
    : "最新記錄已達最低價";
  element("chart-range").textContent = prices.length > 1
    ? `${formatDate(prices[0].date.slice(0, 10))} – ${formatDate(latest.date.slice(0, 10))}`
    : "目前有 1 筆價格紀錄";

  const records = prices.slice(-6).reverse().map(entry => {
    const row = document.createElement("tr");
    row.insertCell().textContent = formatDate(entry.date);
    row.insertCell().textContent = formatPrice(entry.price);
    return row;
  });
  element("records").replaceChildren(...records);
  updateView();
}

function retrySearch() {
  void search(true);
}

function showLookupError(error) {
  if (error.status === 401 || error.status === 403) {
    showState("API 驗證未通過", "請確認 Token 是否與 TWBuyers 核發的資訊相符。", "API 設定", toggleSettings);
    return;
  }
  if (error.status === 429) {
    showState("查詢次數達到上限", "請稍候再查詢。", "重試", retrySearch);
    return;
  }
  if ([400, 404, 422].includes(error.status)) {
    showState("無法查詢此網址", "請確認目前開啟的是商品詳情頁。", "重試", retrySearch);
    return;
  }
  if (error.name === "TimeoutError") {
    showState("TWBuyers 回應逾時", "請稍候再試。", "重試", retrySearch);
    return;
  }
  showState("查詢失敗", "請確認網路連線後再試一次。", "重試", retrySearch);
}

function showMissingToken() {
  showState("請先設定 TWBuyers API", "儲存驗證資訊後，這個分頁就會自動查價。", "API 設定", toggleSettings);
}

async function search(retry = false) {
  const currentRequest = ++requestId;
  busy = false;
  if (!shopping) {
    showState("目前分頁無法查價", "請開啟 PChome 24h、momo 或 Yahoo 購物中心的商品頁。");
    return;
  }
  if (!token) {
    showMissingToken();
    return;
  }

  busy = true;
  showState("正在查詢歷史價格", shopping.platform);
  try {
    const response = await chrome.runtime.sendMessage({ type: "price-history", url: shopping.url, retry });
    if (currentRequest !== requestId) return;
    busy = false;
    if (response.kind === "missing-token") {
      showMissingToken();
    } else if (response.kind === "error") {
      showLookupError(response);
    } else if (response.history) {
      renderResult(response.history);
    } else {
      showState("查無歷史價格", "請確認目前開啟的是商品詳情頁。", "重試", retrySearch);
    }
  } catch (error) {
    if (currentRequest !== requestId) return;
    busy = false;
    showLookupError(error);
  }
}

async function start() {
  settingsToggle.disabled = true;
  try {
    const [[tab], stored] = await Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      chrome.storage.local.get(credentialKey),
    ]);
    shopping = productPage(tab?.url);
    token = readToken(stored[credentialKey]);
    void search();
  } catch {
    showState("無法讀取目前分頁或設定", "請再試一次。", "重試", start);
  } finally {
    settingsToggle.disabled = false;
  }
}

settingsToggle.addEventListener("click", toggleSettings);
settings.addEventListener("submit", event => {
  event.preventDefault();
  void saveSettings();
});
clearSettings.addEventListener("click", () => void saveSettings(true));
stateAction.addEventListener("click", () => stateHandler?.());
image.addEventListener("load", () => { image.hidden = false; });
image.addEventListener("error", () => { image.hidden = true; });
void start();
