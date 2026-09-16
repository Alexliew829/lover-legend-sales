Lover Legend Sales System V49.2 Stable
Build: 4920

BASELINE
- V49.2 continues from V49.1.
- V49.1 itself was rebuilt directly from the user-confirmed V48.8 perfect-sync / stable-running source.
- V48.8/V49.1 priorityRevisionV456 cadence and authoritative sync architecture are preserved.

V49.2 CHANGES (minimal only)
1. Cross-device Sales Card full-content sync
   - A changed authoritative Sales Card context is now committed to BOTH memory cache and persistent Sales Card cache.
   - Fixes the tested case where another device received the correct draft status but still displayed only Product 1 after Product 2 was added and saved remotely.
   - The same exact-context update also keeps remote product add/remove/edit results consistent after reopening the card.
2. Sales Card state consistency
   - The same authoritative context now replaces stale persistent card state, reducing temporary repaint from an older saved/confirmed state after a newer draft sync arrives.
3. Compact operation status text
   - Sales / Fair / Live use section-first labels such as:
     Fair · Sales Card 保存中
     Fair · Sales Card 删除中
     Fair · 新增营业额 保存中
   - Redundant “正在写入云端” wording is removed from these active-operation labels.
4. V49.1 fixes retained
   - Sales Card auto-collapse.
   - Fair latest-context follow.
   - Deleted Sales Card stale-cache protection.
   - Fair Sales Card sync wording.

UNCHANGED
- No new polling, timer, or sync cadence.
- V48.8 turnover sync/detail architecture.
- Import ACK / duplicate inventory protections.
- Cost, profit, commission, VND pot-cost and Live local-delivery formulas.
- UI/layout outside requested status wording.

UPDATE REQUIRED
- Frontend: YES
- Apps Script / Code.gs: YES (version/API markers 4920)
- Redeploy Web App: YES
