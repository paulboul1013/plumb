# factory

給 coding agent 用的軟體工廠流程。每個任務先分「車道」(lane),再依大小與可逆性設定「嚴謹度」(rigor),然後才動手。

它結合了兩套流程的長處:

- [mattpocock/skills](https://github.com/mattpocock/skills):先對齊再動手(grilling、共享詞彙表、spec、tracer-bullet tickets、兩軸 code review、retro)。
- [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack):依任務類型路由到 playbook、在真實介面上驗證、把教訓寫成檢查腳本而不是更多文字、何時該問人何時不該問。

## 為什麼要混合

| 問題 | Matt 的做法 | pstack 的做法 | factory 的取捨 |
| --- | --- | --- | --- |
| Agent 做錯東西 | 每次都 grill 使用者 | 盡量不擋人,能跑就跑 | 問題先分三類:事實自己查、可實驗的自己跑、只有使用者能決定的才問(`align`) |
| 流程太重或太輕 | 一條主流程 + 入口 | 二十多個 playbook | 6 條車道 × 3 級嚴謹度,用「大小 × 單向門」表格決定 |
| 程式碼不 work | TDD + 回饋迴路 | 在真實介面上證明 | `tdd` 在約定好的 seam 上寫測試,`prove` 在使用者會碰到的介面上驗證 |
| 大泥球 | deep module 詞彙 | 先定資料結構、多方案比較 | `design`:先寫呼叫端、定資料形狀,Strict 時平行產生 2 到 3 個方案 |
| 多 session 工作 | spec → tickets → 依 frontier 平行實作 | 每個 PR 一個 owner + 驗證 | `tickets` 每張都要有 Proof,`check-tickets.mjs` 驗證依賴圖,`orchestrate` 依 frontier 平行建構 |
| Review 被單一視角主導 | Standards + Spec 兩軸分開跑 | 多模型對抗式 review | Standards、Spec、Proof 三軸分開,Strict 再加雙模型對抗 |
| 同樣的錯一直犯 | retro 改環境 | 把教訓編進結構 | `/factory:retro` 依序嘗試:結構、檢查、測試、規範、指標,並證明檢查會在舊錯誤上變紅 |

## 車道與嚴謹度

`factory` 路由 skill 先挑車道:

| 訊號 | 車道 |
| --- | --- |
| 只是問問題 | Investigate |
| 跑起來就能回答的設計問題 | Prototype |
| 壞了、慢了、時好時壞 | Bug |
| 結構要變、行為不能變 | Refactor |
| 新行為,一個 session 做得完 | Feature |
| 跨 session,或終點還看不清楚 | Epic |
| 單檔、檢查明顯、沒有設計選擇 | Direct |

再用兩個軸決定嚴謹度:

| 大小 | 雙向門(可 revert) | 單向門(migration、公開 API、資安、刪資料) |
| --- | --- | --- |
| S 單一模組 | Light | Standard |
| M 跨模組邊界 | Standard | Strict |
| L 跨子系統或 session | Strict | Strict |

嚴謹度決定每一步有多重。例如 Light 只要一句話確認目標、跑一次最近的檢查,Strict 則要完整 `align` + `domain`、多方案設計、characterization pin、三軸 + 對抗 review、`trail` 決策紀錄。細節在 [skills/factory/SKILL.md](skills/factory/SKILL.md)。

證據改變時要重新分類,例如修 bug 時發現原因橫跨三個模組,就從 Light 升到 Standard。

## Epic 主流程

```
align + domain ─► spec ─► tickets ─► check-tickets.mjs
   (同一個 context window,做完 tickets 前不要 clear)
                                      │
                 ┌────────────────────┴───────────────────┐
           implement(每張 ticket 開新 session)     orchestrate(依 frontier 平行)
                 └────────────────────┬───────────────────┘
                            review(三軸)─► deliver ─► /factory:retro
```

## Skills

模型可自動呼叫:`factory`(路由)、`align`、`domain`、`design`、`spec`、`tickets`、`implement`、`orchestrate`、`tdd`、`diagnose`、`prove`、`review`、`deliver`、`trail`。

只有使用者能呼叫:`/factory:setup`、`/factory:retro`、`/factory:handoff`。

Agents:`factory-builder`(實作單一 ticket)、`factory-reviewer`(唯讀,一次只看一個 review 軸)。

## 安裝

```bash
claude plugin marketplace add <path-to-this-repo>
claude plugin install factory@factory-local
```

之後在每個 repo 跑一次 `/factory:setup`,它會寫出 `docs/agents/factory.md`(issue tracker、檢查指令、怎麼啟動和操作 app)。

### Hooks

- **SessionStart**:注入路由指令,讓 agent 在任何程式變更前先呼叫 `factory` skill。
- **Stop(完成閘門)**:只在已跑過 `/factory:setup`(有 `docs/agents/factory.md` 或 `.factory/`)的 repo 生效。工作目錄有未 commit 的變更時,第一次停止會被擋下一次,要求 agent 補印車道與嚴謹度、確認每個步驟完成或寫明跳過理由,並在 Standard 或 Strict 時跑 `review`。同一個工作目錄狀態只擋一次,第二次停止一定放行,所以不會無限循環。

實測發現單靠文字指示,agent 在小 repo 上常會跳過 review;加上這個閘門後,review 才穩定執行,而且在測試中抓到了真的捨入 bug。

### 和 pstack 並存

pstack 的 SessionStart hook 會要求所有任務先走 `poteto-mode`,和 factory 的路由衝突。兩個都裝時,關掉其中一個 hook:

- 關 pstack 的:在 `~/.claude/pstack-models.md` 把 `session hook: on` 改成 `session hook: off`。
- 關 factory 的:設定環境變數 `FACTORY_HOOK=off`。

pstack 的 skill(`arena`、`interrogate` 等)關掉 hook 後仍可手動使用。

完整的切換步驟(用 factory、換回 pstack、兩邊都關)見 [docs/pstack-conflict.md](docs/pstack-conflict.md)。

## 檢查腳本

```bash
node scripts/check-plugin.mjs        # frontmatter、連結、user-invoked 引用方式、路由清單是否完整、禁止長破折號
node scripts/check-tickets.mjs <dir> # ticket 編號、依賴、狀態、Acceptance 與 Proof
node scripts/check-tickets.mjs <dir> --frontier   # 列出現在可以開工的 tickets
node --test scripts/test/*.test.mjs# 腳本本身的測試
```

## 授權與來源

MIT。部分內容改寫自 mattpocock/skills(MIT,Matt Pocock)和 cursor/plugins 的 pstack(MIT,Lauren Tan)。`skills/tdd/tests.md`、`skills/tdd/mocking.md`、`skills/domain/GLOSSARY-FORMAT.md`、`skills/domain/ADR-FORMAT.md` 直接取自 mattpocock/skills。
