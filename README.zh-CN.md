# talkps

[English](README.md) | [简体中文](README.zh-CN.md)

这是一个用于在 Codex 工作流中驱动 Adobe Photoshop 的轻量桥接仓库，包含以下内容：

- **ExtendScript/JSX 桥接**（`ps_agent.jsx` + `ps_call.sh`），以 JSON 方式进行命令输入/输出。
- **UXP 面板示例**（`main.js`, `manifest.json`），展示现代 Photoshop 插件调用方式。
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

该 `ping` 命令用于确认 Photoshop 可以执行 JSX 桥接脚本，并验证 JSON 请求/响应链路是否正常。

3. 如果要查看当前文档信息：

```bash
./ps_call.sh '{"command":"get_document_info"}'
./ps_call.sh '{"command":"list_layers"}'
```

4. 带参数的示例（JSON 输入）：

```bash
./ps_call.sh '{"command":"add_text_layer","params":{"text":"Hello","font":"ArialMT","size":48,"color":[255,0,0],"position":[100,200]}}'
./ps_call.sh '{"command":"create_document","params":{"width":1200,"height":800,"resolution":72,"name":"Hero","mode":"RGB","fill":"WHITE"}}'
./ps_call.sh '{"command":"add_empty_layer","params":{"name":"Base"}}'
./ps_call.sh '{"command":"merge_active_down"}'
./ps_call.sh '{"command":"merge_visible_layers"}'
./ps_call.sh '{"command":"list_fonts"}'
./ps_call.sh '{"command":"duplicate_active_layer","params":{"name":"Copy"}}'
./ps_call.sh '{"command":"rename_active_layer","params":{"name":"Hero"}}'
./ps_call.sh '{"command":"set_active_layer_visibility","params":{"visible":false}}'
./ps_call.sh '{"command":"set_active_layer_opacity","params":{"opacity":55}}'
./ps_call.sh '{"command":"set_active_layer_blend_mode","params":{"mode":"MULTIPLY"}}'
./ps_call.sh '{"command":"resize_image","params":{"width":800,"height":600,"resample":"BICUBIC"}}'
./ps_call.sh '{"command":"resize_canvas","params":{"width":1000,"height":800,"anchor":"MIDDLECENTER"}}'
./ps_call.sh '{"command":"rotate_canvas","params":{"angle":90}}'
./ps_call.sh '{"command":"save_active_document_as","params":{"path":"/tmp/hero.psd","format":"psd"}}'
./ps_call.sh '{"command":"delete_active_layer"}'
```

示例命令含义：
- `create_document`：创建指定尺寸/模式/底色的新文档。
- `get_document_info`：返回当前文档的尺寸、颜色模式等信息。
- `list_layers`：列出当前文档中的图层名称、ID、可见性。
- `add_text_layer`：按指定内容与样式新增文字图层。
- `add_empty_layer`：新增一个空白像素图层（可指定名称）。
- `merge_active_down`：将当前图层与下方图层合并。
- `merge_visible_layers`：合并所有可见图层。
- `list_fonts`：返回可用字体列表。
- `duplicate_active_layer`：复制当前图层（可指定新名称）。
- `rename_active_layer`：重命名当前图层。
- `set_active_layer_visibility`：显示或隐藏当前图层。
- `set_active_layer_opacity`：设置当前图层不透明度（0-100）。
- `set_active_layer_blend_mode`：设置当前图层的混合模式。
- `resize_image`：调整像素尺寸或分辨率。
- `resize_canvas`：调整画布尺寸并指定锚点。
- `rotate_canvas`：按角度旋转画布。
- `save_active_document_as`：保存到指定路径/格式。
- `delete_active_layer`：删除当前图层。

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
- `ping`（验证 JSX 桥接与 JSON 请求/响应链路）
- `get_document_info`（文档尺寸、模式、元数据）
- `list_layers`（图层列表、ID 与可见性）
- `list_fonts`（可用字体列表）

**文档管理**
- `create_document`（创建新文档）
- `open_document`（打开已有文档）
- `save_active_document`（保存当前文档）
- `save_active_document_as`（按指定格式保存）
- `close_active_document`（按保存选项关闭）
- `duplicate_active_document`（复制当前文档）
- `flatten_active_document`（合并为单一背景）
- `resize_image`（调整像素尺寸/分辨率）
- `resize_canvas`（调整画布尺寸）
- `rotate_canvas`（旋转画布）

**文字相关**
- `add_text_layer`（设置文字内容、字体、字号、颜色、位置）

**图层管理**
- `add_empty_layer`（新增空白像素图层）
- `merge_active_down`（合并当前图层与下方图层）
- `merge_visible_layers`（合并所有可见图层）
- `duplicate_active_layer`（复制当前图层）
- `delete_active_layer`（删除当前图层）
- `rename_active_layer`（重命名当前图层）
- `set_active_layer_visibility`（切换当前图层可见性）
- `set_active_layer_opacity`（设置当前图层不透明度）
- `set_active_layer_blend_mode`（设置当前图层混合模式）

## 官方文档来源

以下是用于映射 Photoshop 脚本 API 的官方来源：

- Photoshop JavaScript Reference（PDF, 2020）：https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551504/1/photoshop-javascript-ref-2020-online2pdf-version.pdf
- Photoshop Scripting Guide（PDF, 2020）：https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551569/1/photoshop-scripting-guide-2020-online2pdf-version.pdf
- Scripting in Photoshop（HelpX）：https://helpx.adobe.com/photoshop/using/scripting.html

## UXP 面板示例

`main.js` 与 `manifest.json` 定义了一个最小 UXP 面板示例，它使用 `batchPlay` 添加红色背景层，可作为 UXP 工作流的起点。

## 说明

- `run_ps.sh` 依赖 AppleScript，仅支持 macOS。
- `ps_agent.jsx` 除 `ping` 之外的命令都需要打开文档。
