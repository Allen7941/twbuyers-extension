# TWBuyers Info API 串接說明

來源：[TWBuyers Info API 串接說明](https://twbuyers.info/connectToAPI)

## API 端點

```http
POST https://api.twbuyers.info/search-v2
```

## API 金鑰（API Key）

呼叫 API 須通過金鑰驗證。開發者會在申請核准後提供驗證方式及串接細節。

### 申請方式

目前需透過[意見回饋](mailto:aaron-chuang@haoder.dev)向開發者申請金鑰，並提供下列資訊：

1. 專案或使用情境，以及預估的請求頻率。
2. 使用的平台與程式語言，例如 Web、iOS、Android、Python 或 Node.js。
3. 是否同意下列 API 使用規範。

### API 使用規範

- 金鑰限申請者本人或申請時所屬專案使用。請妥善保管，禁止公開、轉讓或分享。
- 控制呼叫頻率，避免在短時間內送出大量重複請求。
- 引用資料時須標明來源為 TWBuyers Info。實際售價以電商平台公布的價格為準。
- 禁止轉售 API 資料或用於其他商業用途。
- 違規或長期未使用時，開發者可停用金鑰。若端點或資料格式有重大變更，開發者會盡可能事先通知。

## 請求格式

請將下列 JSON 放在請求本文（Body → Raw → JSON）。

```json
{
  "url": "https://www.exampleshop.com/goods/123456",
  "months": 12
}
```

| 欄位 | 說明 |
| --- | --- |
| `url` | 要查詢的商品網址。 |
| `months` | 查詢的月數。此欄位可省略，預設為 `12`。 |

## 回應格式

成功回應範例：

```json
{
  "name": "商品名稱範例",
  "url": "https://www.exampleshop.com/goods/123456",
  "pic_url": "https://img.exampleshop.com/123456.webp",
  "prices": [
    [2980, "2025-05-23 21:31:26"],
    [2580, "2025-06-04 05:15:53"],
    [2680, "2025-07-01 02:14:31"]
  ]
}
```

`prices` 是歷史價格陣列，每筆資料依序包含價格和時間戳記，格式為 `[價格, 時間戳記]`。查詢失敗時，API 會回傳 `null` 或空物件 `{}`。

## 注意事項

- 查詢結果供參考，實際售價請以電商平台為準。
- 如有串接問題或建議，可透過[意見回饋](mailto:aaron-chuang@haoder.dev)聯絡開發者。
