# 多 runtime 加载

本插件的主路径是 Claude Code。Cursor 和其他 agent 读同一批 `skills/<name>/SKILL.md`。没有第二种运行时，也没有安装脚本。

## 1. Claude Code

在目标仓库启动时加载本插件目录：

```bash
claude --plugin-dir <插件根>
```

插件清单仍是 `.claude-plugin/plugin.json`。本说明不改插件名、作者、描述句。

## 2. Cursor

把本仓库作为工作区打开即可。技能文件在 `skills/<name>/SKILL.md`。

不新增 Cursor 插件清单，不把 skill 复制到 `.cursor/skills/`，不把规则改写成另一套 Cursor rules 包。

## 3. 其他能读目录的 agent

把插件根放进该 agent 的可读路径，按 `skills/*/SKILL.md` 加载。没有第二种运行时，也没有安装脚本。

## 4. description 只有触发条件

下面七个文件的 YAML `description` 以 `Use when` 开头。流程写在正文，不写进描述：

- `skills/admin-modernize/SKILL.md`
- `skills/admin-recon/SKILL.md`
- `skills/admin-repo-split/SKILL.md`
- `skills/admin-guardrails/SKILL.md`
- `skills/admin-preview-loop/SKILL.md`
- `skills/admin-api-contract/SKILL.md`
- `skills/admin-legacy-migration/SKILL.md`

描述里只留触发条件。不写「先摸底再约束面再对接面」这类过程。

## 不做的事

不包装新的发布格式。不改 skill 的发现路径。不把 `claude --plugin-dir` 换成别的启动器。
