# talkps

[English](README.md) | [简体中文](README.zh-CN.md)

这是一个用于在 Codex 工作流中驱动 Adobe Photoshop 的轻量桥接仓库，包含以下内容：

- **ExtendScript/JSX 桥接**（`ps_agent.jsx` + `ps_call.sh`），以 JSON 方式进行命令输入/输出。
- **技能包**（`skills/photoshop-jsx-scripting`），包含官方参考与扩展流程。

## 架构

```
ps_call.sh -> run_ps.sh -> Photoshop -> ps_agent.jsx -> ps_response.json
```

- `ps_call.sh` 写入请求 JSON，调用 Photoshop 执行 `ps_agent.jsx`，并输出响应。
- `ps_agent.jsx` 从脚本目录读取 `ps_request.json`，写回 `ps_response.json`。
- `run_ps.sh` 使用 AppleScript (`osascript`) 让 Photoshop 执行 JSX 脚本。

## 快速开始（JSX 桥接）

1. 打开 Photoshop 并保持运行。
2. 在本仓库下运行：

```bash
./ps_call.sh '{"command":"ping"}'
```

3. 如果要查看当前文档信息：

```bash
./ps_call.sh '{"command":"get_document_info"}'
./ps_call.sh '{"command":"list_layers"}'
```

4. 带参数的示例（JSON 输入）：

```bash
./ps_call.sh '{"command":"add_text_layer","params":{"text":"Hello","font":"ArialMT","size":48,"color":[255,0,0],"position":[100,200]}}'
./ps_call.sh '{"command":"merge_active_down"}'
./ps_call.sh '{"command":"merge_visible_layers"}'
./ps_call.sh '{"command":"list_fonts"}'
./ps_call.sh '{"command":"duplicate_active_layer","params":{"name":"Copy"}}'
./ps_call.sh '{"command":"rename_active_layer","params":{"name":"Hero"}}'
./ps_call.sh '{"command":"set_active_layer_visibility","params":{"visible":false}}'
./ps_call.sh '{"command":"set_active_layer_opacity","params":{"opacity":55}}'
./ps_call.sh '{"command":"delete_active_layer"}'
```

### 配置覆盖

默认情况下脚本会在当前目录读写 `ps_request.json` / `ps_response.json`。如需自定义路径，可设置：

- `PS_REQUEST_FILE`
- `PS_RESPONSE_FILE`
- `PS_AGENT_JSX`
- `PS_RUNNER`

示例：

```bash
PS_REQUEST_FILE=/path/to/ps_request.json \
PS_RESPONSE_FILE=/path/to/ps_response.json \
./ps_call.sh '{"command":"list_layers"}'
```

## 技能包

Photoshop 技能包位于 `skills/photoshop-jsx-scripting`，包含：

- 官方脚本文档入口。
- 如何新增命令到 `ps_agent.jsx`。
- 当 DOM API 不足时如何使用 Action Manager。

## 当前已支持的操作

以下是 `ps_agent.jsx` 目前已经实现的 Photoshop 操作：

**健康检查与信息获取**
- `ping` — 检查桥接是否可用。
- `get_document_info` — 获取当前文档信息（名称、尺寸、分辨率、模式）。
- `list_layers` — 列出图层树（含分组、边界、可见性）。
- `list_fonts` — 列出已安装字体（名称、族、样式、PostScript 名称）。

**文字相关**
- `add_text_layer` — 创建文字图层并设置内容、字体、字号、颜色、位置。

**图层管理**
- `merge_active_down` — 将当前图层向下合并。
- `merge_visible_layers` — 合并所有可见图层。
- `duplicate_active_layer` — 复制当前图层（可选重命名）。
- `delete_active_layer` — 删除当前图层。
- `rename_active_layer` — 重命名当前图层。
- `set_active_layer_visibility` — 设置当前图层显示/隐藏。
- `set_active_layer_opacity` — 设置当前图层透明度（0-100）。

## 官方文档来源

以下是用于映射 Photoshop 脚本 API 的官方来源：

- Photoshop JavaScript Reference（PDF, 2020）：https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551504/1/photoshop-javascript-ref-2020-online2pdf-version.pdf
- Photoshop Scripting Guide（PDF, 2020）：https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551569/1/photoshop-scripting-guide-2020-online2pdf-version.pdf
- Scripting in Photoshop（HelpX）：https://helpx.adobe.com/photoshop/using/scripting.html

## 说明

- `run_ps.sh` 依赖 AppleScript，仅支持 macOS。
- `ps_agent.jsx` 除 `ping` 之外的命令都需要打开文档。
