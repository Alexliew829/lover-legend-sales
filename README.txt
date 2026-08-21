Lover Legend Sales System V22.6 PERFECT STABLE

V22.6 修复：
- 修复 iPhone / iOS 销售卡 Import System 产品搜索结果仍会自动收起的问题。
- 搜索结果在输入、键盘候选、iOS 暂时失焦、Import 异步读取完成时保持展开。
- 不再使用 blur / focusout / pointerdown 作为自动关闭条件。
- 只有选择一个产品，或真正点击搜索区域外，才会关闭产品结果列表。
- 加入异步搜索序号保护，旧的 Import 请求完成后不会覆盖/关闭新的搜索结果。
- 防止 Sales_Product_Links 云端读取完成时重新 Render 销售卡，导致正在使用的搜索 dropdown 消失。
- Live / Fair 共用相同修复。
- 保留 V22.5 其他稳定功能与 Import 产品预加载/缓存加速。

Apps Script / Code.gs：
- 业务逻辑不需要更新；本包内版本标记已同步为 V22.6 / 2260。
appsscript.json：不需要更新。
Import Cost System：不需要更新。

版本：V22.6 / 2260 / ?v=22.6
