# Simplified Chinese listing (zh_CN)

Chrome: Developer Dashboard > Store listing > language "Chinese (China)" > Description.
Firefox: Developer Hub > Edit Product Page > language "中文 (简体)".

---

直接在页面上价格所在的位置、原价旁边，看到外币价格换算成你的货币是多少。

打开使用其他货币的商店，Twinprice 会找到价格、提议换算，并在你确认之前显示汇率。每个换算后的金额都显示在原价旁边，因此你始终能看到商店实际收取的金额。

为什么需要读取和更改所有网站上的数据
价格可能出现在任何商店中，因此 Twinprice 需要查看你打开的页面才能发现价格。它只在你的设备上读取页面。页面内容、价格和你访问的网站永远不会离开你的浏览器。唯一发送出去的是一个三字母货币代码（例如 EUR），用于获取当天的参考汇率。唯一的例外是“报告此网站”：当页面无法换算而你点击它时，只会将网站名称（例如 shop.example）发送到 twinprice.com，以便修复问题。没有广告、分析或跟踪。代码以 MIT 许可证开源：github.com/somewordshere/twinprice

可以换算的内容
- 一键换算页面上的所有价格
- 你选中的单个价格
- 你在弹出窗口中输入的任意金额

货币
- 可换算为 160 多种货币，支持按代码或名称搜索
- 自动从页面检测 50 种货币
- 格式正确，例如日元不带小数，第纳尔保留三位小数

为真实的商店而设计
- 能处理复杂的价格布局，并针对 Allegro、Digitec、Trendyol 和 tap.az 等商店做了修复
- 能识别现代商店页面上稍后加载的价格
- 标记你最常用的商店，即可自动换算
- 撤销后，页面会完全恢复原样
- 键盘快捷键：Ctrl+Shift+Y（Mac 上为 Command+Shift+Y）

关于汇率
参考汇率来自 Frankfurter，它在每个工作日发布欧洲中央银行的汇率。这些汇率用于比较价格，并不是你的银行或银行卡实际收取的汇率，也不包含手续费。

限制
图片中的价格和某些嵌入框架中的价格无法换算。在不常见的布局上，你可能需要自己选择原货币。

免费，无需账户。适用于 Chrome 和 Firefox，包括 Android 版 Firefox。

如果 Twinprice 对你有帮助，留下一条简短的评价可以帮助其他购物者找到它。
