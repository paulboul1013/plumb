# plumb 與 pstack 的衝突處理

## 為什麼會衝突

plumb 和 pstack 都有 SessionStart hook。每次開新 session,兩邊都會注入「改程式前先走我的路由」的指令:

- pstack 要求先呼叫 `pstack:poteto-mode`。
- plumb 要求先呼叫 `plumb:plumb`。

兩個 hook 同時開著,agent 會收到兩套互相矛盾的流程。所以同一時間只開一邊的 hook。

兩邊的 skill 不會衝突。hook 關掉後,那一邊的 skill 仍然可以手動呼叫,例如 `/pstack:arena` 或 `/plumb:retro`。

## 兩個開關

| 開關 | 位置 | 開 | 關 |
| --- | --- | --- | --- |
| pstack 的 hook | `~/.claude/pstack-models.md` | `session hook: on` | `session hook: off` |
| plumb 的 hook | 環境變數 `PLUMB_HOOK` | 不設定,或設成 `on` | `PLUMB_HOOK=off` |

`PLUMB_HOOK=off` 會同時關掉 plumb 的 SessionStart hook 和 Stop 完成閘門。

改完開關後,要開一個新的 Claude Code session 才會生效。

## 模式一:用 plumb(目前的設定)

1. 在 `~/.claude/pstack-models.md` 裡寫 `session hook: off`。
2. 不設定 `PLUMB_HOOK`。

## 模式二:換回 pstack

1. 把 `~/.claude/pstack-models.md` 裡的那一行改回 `session hook: on`。
2. 關掉 plumb 的 hook,下面兩種方式擇一:
   - 在 `~/.claude/settings.json` 加上環境變數,這樣每個 session 都會套用:

     ```json
     {
       "env": {
         "PLUMB_HOOK": "off"
       }
     }
     ```

     如果檔案裡已經有 `env` 區塊,把 `"PLUMB_HOOK": "off"` 加進去就好,不要再新增第二個 `env`。
   - 或者直接停用整個 plumb plugin:`claude plugin disable plumb@plumb-local`。要回到 plumb 時再執行 `claude plugin enable plumb@plumb-local`。

## 模式三:兩邊的 hook 都關

1. 寫 `session hook: off`。
2. 設定 `PLUMB_HOOK=off`。

兩邊的 skill 都只會在你手動呼叫時執行。

## 怎麼確認目前是哪一邊生效

開一個新 session,要求改一段程式,然後看 agent 先呼叫哪個 skill:

- 先呼叫 `plumb:plumb`,並印出 `lane: ... · rigor: ...`,代表 plumb 生效。
- 先呼叫 `pstack:poteto-mode`,代表 pstack 生效。
- 兩個都呼叫了,代表兩邊的 hook 都還開著,回頭檢查上面的開關。
