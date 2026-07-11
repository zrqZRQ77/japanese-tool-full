# AI 协作目录

本目录用于本地 Codex 与 ChatGPT 网页端交换上线前审查信息。

## 权限

- 本地 Codex：维护本目录中除网页端审查报告外的文件，并读取、处理审查报告。
- ChatGPT 网页端：可以读取整个项目；唯一写入权限是在 `reviews/` 中新建 `chatgpt-review-*.md`。
- ChatGPT 网页端不得编辑或删除已有报告，不得修改本目录其他文件，也不得修改业务代码或正式上线资料。

## 每轮流程

1. Codex更新 `CURRENT_BASELINE.md`、`CODEX_STATUS.md` 和 `CHATGPT_REVIEW_REQUEST.md`。
2. 网页端读取上述文件及 `reviews/REVIEW_TEMPLATE.md`。
3. 网页端新建 `reviews/chatgpt-review-YYYYMMDD-round-NN.md`。
4. 网页端在聊天中只回复报告路径和简短结论。
5. Codex读取报告，复现问题并更新 `ISSUE_QUEUE.md`。
6. 只有 `DECISIONS_NEEDED.md` 出现内容时，用户才需要作出关键决定。

如需更正旧报告，网页端应新建 `chatgpt-review-YYYYMMDD-round-NN-correction-NN.md`，不得覆盖原文件。
