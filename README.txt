Lover Legend Sales V20.0

V20.0 Home company comparison fixed columns:
- Balakong 永远固定左栏。
- Belimbing 永远固定右栏。
- 收起 Balakong：只隐藏 Balakong 本月销售记录，Belimbing 原位不动。
- 收起 Belimbing：只隐藏 Belimbing 本月销售记录，Balakong 原位不动。
- 两边都展开：保持左右比较。
- 两边都收起：只保留上方两张本月总数卡。
- 保留 V19.9 已修好的：一次点击立即展开、展开区绿色总数、每日金额红色、缺失日期补 RM0.00。
- 不修改 Sales / Fair / Live / Report / 通知 / 同步 / Device Registry 业务逻辑。
- Apps Script 无业务逻辑更新；Code.gs 仅同步版本号。
Lover Legend Sales V20.0

Home 本月公司销售记录修复：
- 保留 V19.8 已修好的「一次点击立即展开」。
- Balakong / Belimbing 顶部本月总数卡永久保留。
- 两家公司仍然左右并排、独立展开，可同时比较。
- 展开区恢复「Balakong 本月销售记录 / Belimbing 本月销售记录」。
- 展开区顶部恢复本月总数，使用绿色字体。
- 总数采用 Top 5 金额相同的防截断思路：nowrap、tabular nums、独立完整宽度，RM33,602.40 等可完整显示。
- 左右两家公司共用同一套日期轴；任何一边某日没有销售，自动显示 RM0.00。
- 每日金额继续红色。
- 不增加 Google Sheet 请求，不改 Sales / Fair / Live / Report / 通知 / 同步 / Device Registry。

Apps Script：无业务逻辑更新，仅版本号同步。

