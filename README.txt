Lover Legend Sales V55.2 / Build 5520

V55.2 修改范围：
- 修复 Home「本年度累计」年度资料读取失败。
- 根因：全年读取成功返回后，前端在 year-scope 路径调用 pending reconciliation 时引用了不存在的 `month` 变量，触发 ReferenceError，导致完整年度资料无法标记为已载入。
- 修复方式：全年资料按 01-12 月逐月执行 stale pending reconciliation，保留原有跨设备删除保护，不再因未定义变量中断全年载入。
- Sales / Fair / Live 正常月份读取与保存逻辑不改。
- V55.0 运费/附加费用输入框等宽 UI 保留。
- 不修改营业额、成本、利润、利润率、佣金公式；不修改 Sales Card、Pending、Inventory ACK、Global Revision、同步轮询或 Fair/Live 全年缓存规则。