# TWBuyers 歷史價格 Chrome 擴充元件

開啟 PChome 24h、momo 購物網或 Yahoo 購物中心的商品頁後，擴充元件會在背景向 TWBuyers Info 查詢近 12 個月的歷史價格。

## 安裝與設定

1. 在 Chrome 開啟 `chrome://extensions`，打開右上角的「開發人員模式」。
2. 按「載入未封裝項目」，選擇專案內包含 `manifest.json` 的 `extension` 資料夾。
3. 專案不附 API Token。請依 [API 串接說明](docs/connectToAPI.md) 向 TWBuyers Info 申請，並在擴充元件的「API 設定」貼上核發的 Token 後儲存。請勿分享 Token 或將它提交到 Git。
4. 開啟支援平台的商品詳情頁，點擊工具列的擴充元件。彈出視窗會顯示最新記錄、最低價、走勢，以及可展開的近期價格紀錄。

## 網址與 Token 的使用方式

Token 儲存在目前 Chrome 設定檔。儲存後，載入或切換到支援的商品頁時，擴充元件會在背景以 HTTPS 將商品網址及 Token 送往 TWBuyers Info 查價，Token 用於 API 驗證。背景和彈出視窗都只查詢可辨識的商品頁，送出前會移除網址片段與查價不需要的參數，例如追蹤參數。

彈出視窗會共用進行中的查詢，並重用五分鐘內的結果。在「API 設定」選擇「清除金鑰」即可移除 Token，停止後續 API 請求。
