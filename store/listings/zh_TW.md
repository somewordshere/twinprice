# Traditional Chinese listing (zh_TW)

Please read this through before pasting. It is a translation of `en.md`;
fix anything that doesn't sound natural to a shopper in this language.

Chrome: Developer Dashboard > Store listing > language "Chinese (Taiwan)" > Description.
Firefox: Developer Hub > Edit Product Page > language "正體中文 (繁體)".

---

直接在頁面上價格所在的位置、原價旁邊，看到外幣價格換算成你的貨幣是多少。

開啟一家使用其他貨幣的商店，Twinprice 就會找出價格、提議換算，並在你同意前先顯示匯率。每個換算後的金額都會出現在原價旁，讓你隨時看到商店實際收取的金額。

為什麼它要求讀取和變更所有網站上的資料
價格可能出現在任何商店，所以 Twinprice 必須查看你開啟的頁面才能發現價格。它只在你的裝置上讀取這些頁面。頁面內容、價格和你造訪的網站絕不會離開你的瀏覽器。唯一會傳送出去的，是像 EUR 這樣的三個字母貨幣代碼，用來取得當天的參考匯率。唯一的例外是「回報這個網站」：當某個頁面無法換算而你按下這個按鈕時，只有該網站的名稱（例如 shop.example）會傳送到 twinprice.com，以便修正問題。沒有廣告、沒有分析、沒有追蹤。原始碼以 MIT 授權開放：github.com/somewordshere/twinprice

可以換算的內容
- 頁面上的所有價格，一鍵完成
- 你反白選取的一個價格
- 你在彈出視窗中輸入的任何金額

貨幣
- 可換算成 160 多種貨幣，可依代碼或名稱搜尋
- 可從頁面自動偵測 50 種貨幣
- 格式正確，包括沒有小數的日圓和有三位小數的第納爾

為真實商店打造
- 能處理複雜的價格版面，並針對 Allegro、Digitec、Trendyol 和 tap.az 等商店做了修正
- 能抓到現代商店頁面中稍後才載入的價格
- 將常逛的商店設為自動換算
- 「還原」會讓頁面完全恢復原狀
- 鍵盤快速鍵：Ctrl+Shift+Y（Mac 上為 Command+Shift+Y）

關於匯率
參考匯率來自 Frankfurter，它在每個工作日發布歐洲中央銀行的匯率。這些匯率用於比較價格，並不是你的銀行或信用卡實際收取的匯率，也不包含手續費。

限制
圖片中和部分嵌入框架中的價格無法換算。在特殊的版面上，你可能需要自行選擇原貨幣。

免費，無需帳號。提供 Chrome 版和 Firefox 版，包括 Android 版 Firefox。

如果 Twinprice 對你有幫助，一則簡短的評論能幫助其他購物者找到它。
