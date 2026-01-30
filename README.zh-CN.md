# talkps

[English](README.md) | [简体中文](README.zh-CN.md)

这是一个用于在 Codex 工作流中驱动 Adobe Photoshop 的轻量桥接仓库，包含以下内容：

- **ExtendScript/JSX 桥接**（`skills/photoshop-jsx-scripting/scripts/ps_agent.jsx` + `skills/photoshop-jsx-scripting/scripts/ps_call.sh`），以 JSON 方式进行命令输入/输出。
- **UXP 面板示例**（`main.js`, `manifest.json`），展示现代 Photoshop 插件调用方式。
- **技能包**（`skills/photoshop-jsx-scripting`），包含官方参考与扩展流程。

## 架构

```
ps_call.sh -> run_ps.sh -> Photoshop -> ps_agent.jsx -> ps_response.json
```

- `skills/photoshop-jsx-scripting/scripts/ps_call.sh` 写入请求 JSON，调用 Photoshop 执行 `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx`，并输出响应。
- `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx` 从脚本目录读取 `skills/photoshop-jsx-scripting/scripts/ps_request.json`，写回 `skills/photoshop-jsx-scripting/scripts/ps_response.json`。
- `skills/photoshop-jsx-scripting/scripts/run_ps.sh` 使用 AppleScript (`osascript`) 让 Photoshop 执行 JSX 脚本。

## 快速开始（JSX 桥接）

1. 打开 Photoshop 并保持运行。
2. 在本仓库下运行：

```bash
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"ping"}'
```

该 `ping` 命令用于确认 Photoshop 可以执行 JSX 桥接脚本，并验证 JSON 请求/响应链路是否正常。

3. 如果要查看当前文档信息：

```bash
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"get_document_info"}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"list_layers"}'
```

4. 带参数的示例（JSON 输入）：

```bash
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"add_text_layer","params":{"text":"Hello","font":"ArialMT","size":48,"color":[255,0,0],"position":[100,200]}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"add_text_layer_auto","params":{"text":"Auto layout headline","box":{"x":80,"y":120,"width":640,"height":220},"font":"HelveticaNeue-Bold","stylePreset":"title","align":"CENTER","maxSize":96,"minSize":24,"autoLineBreak":true,"opticalCenter":true}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"create_document","params":{"width":1200,"height":800,"resolution":72,"name":"Hero","mode":"RGB","fill":"WHITE"}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"add_empty_layer","params":{"name":"Base"}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"merge_active_down"}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"merge_visible_layers"}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"list_fonts"}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"duplicate_active_layer","params":{"name":"Copy"}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"rename_active_layer","params":{"name":"Hero"}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"set_active_layer_visibility","params":{"visible":false}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"set_active_layer_opacity","params":{"opacity":55}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"set_active_layer_blend_mode","params":{"mode":"MULTIPLY"}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"resize_image","params":{"width":800,"height":600,"resample":"BICUBIC"}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"resize_canvas","params":{"width":1000,"height":800,"anchor":"MIDDLECENTER"}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"rotate_canvas","params":{"angle":90}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"save_active_document_as","params":{"path":"/tmp/hero.psd","format":"psd"}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"delete_active_layer"}'
```

示例命令含义：
- `create_document`：创建指定尺寸/模式/底色的新文档。
- `get_document_info`：返回当前文档的尺寸、颜色模式等信息。
- `list_layers`：列出当前文档中的图层名称、ID、可见性。
- `add_text_layer`：按指定内容与样式新增文字图层。
- `add_text_layer_auto`：在指定区域内自动排版文字图层。
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

## 自然语言入口 / Natural Language Entry

使用自然语言入口把描述转换成命令并执行：

```bash
./skills/photoshop-jsx-scripting/scripts/ps_nl.sh "创建一个 1200x800 的 RGB 文档，命名为 Hero"
```

通过 `PS_LLM_CMD` 覆盖 LLM 命令（默认使用可用的 `codex exec`）：

```bash
PS_LLM_CMD="codex exec" ./skills/photoshop-jsx-scripting/scripts/ps_nl.sh "列出图层"
```

> 注意：如果本机没有 `codex`，必须设置 `PS_LLM_CMD` 为其它可用 LLM 命令，并确保只输出 JSON。

### 配置覆盖

默认情况下脚本改为使用 `/tmp` 下的临时文件来读写 `ps_request/ps_response`（避免并发冲突）。如需固定路径，可设置：

- `PS_REQUEST_FILE`
- `PS_RESPONSE_FILE`
- `PS_AGENT_JSX`
- `PS_RUNNER`

示例：

```bash
PS_REQUEST_FILE=/path/to/ps_request.json \
PS_RESPONSE_FILE=/path/to/ps_response.json \
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"list_layers"}'
```

## 技能包

Photoshop 技能包位于 `skills/photoshop-jsx-scripting`，包含：

- 官方脚本文档入口。
- 如何新增命令到 `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx`。
- 当 DOM API 不足时如何使用 Action Manager。

## 当前已支持的操作

以下是 `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx` 目前已经实现的 Photoshop 操作：

**健康检查与信息获取**
- `ping`（验证 JSX 桥接与 JSON 请求/响应链路）
- `get_document_info`（文档尺寸、模式、色彩配置、位深）
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
- `measure_text_bounds`（测量文字边界宽高）
- `add_text_layer_auto`（在指定盒子内自动适配字号）
- `fit_text_to_box`（将已有文字图层自动适配到盒子）

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
- `set_layer_style`（设置图层样式：阴影、发光、描边、叠加等）

**选择与选区**
- `select_all`（全选）
- `deselect`（取消选择）
- `invert_selection`（反选）
- `expand_selection`（扩展选区，`amount` 像素）
- `contract_selection`（收缩选区，`amount` 像素）
- `feather_selection`（羽化选区，`radius` 像素）

**图层组**
- `create_layer_group`（创建图层组，`name` 可选）
- `move_layers_to_group`（移动图层到组，`groupId/groupName` + `layerIds/layerNames`）
- `ungroup_layer_group`（解组，`groupId/groupName` 可选）

**调整图层**
- `add_levels_adjustment_layer`（色阶，`name` 可选）
- `add_curves_adjustment_layer`（曲线，`name` 可选）
- `add_hue_saturation_adjustment_layer`（色相/饱和度，`name` 可选）
- `add_black_white_adjustment_layer`（黑白，`name` 可选）

**填充图层**
- `add_solid_fill_layer`（纯色填充，`color` 可选）
- `add_gradient_fill_layer`（渐变填充，`colors/angle/scale/type` 可选）
- `add_pattern_fill_layer`（图案填充，`patternName/patternId` 必选其一）

**图层蒙版**
- `create_layer_mask`（创建蒙版，`fromSelection` 可选）
- `apply_layer_mask`（应用蒙版）
- `delete_layer_mask`（删除蒙版，`apply` 可选）
- `invert_layer_mask`（反相蒙版）

**剪贴蒙版**
- `set_clipping_mask`（设置剪贴蒙版，`enabled` 必填）
- `create_clipping_mask`（创建剪贴蒙版）
- `release_clipping_mask`（释放剪贴蒙版）

**形状图层**
- `add_shape_rect`（矩形，`x/y/width/height` 必填，`color` 可选）
- `add_shape_ellipse`（椭圆，`x/y/width/height` 必填，`color` 可选）

**变换**
- `transform_active_layer`（缩放/旋转/位移，`scaleX/scaleY/rotate/offsetX/offsetY`）
- `flip_active_layer_horizontal`（水平翻转）
- `flip_active_layer_vertical`（垂直翻转）

**对齐与分布**
- `align_layers`（对齐，`layerIds` 必填，`mode/reference` 可选）
- `distribute_layers`（分布，`layerIds` 至少 3 个，`axis` 可选）

**导入与导出**
- `place_image_as_layer`（置入图像为图层，`path` 必填，`name` 可选）
- `export_document`（导出 `png/jpg/webp`，`path/format` 必填）

**历史记录**
- `history_undo`（撤销）
- `history_redo`（重做）

## 官方文档来源

以下是用于映射 Photoshop 脚本 API 的官方来源：

- Photoshop JavaScript Reference（PDF, 2020）：https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551504/1/photoshop-javascript-ref-2020-online2pdf-version.pdf
- Photoshop Scripting Guide（PDF, 2020）：https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551569/1/photoshop-scripting-guide-2020-online2pdf-version.pdf
- Scripting in Photoshop（HelpX）：https://helpx.adobe.com/photoshop/using/scripting.html

## UXP 面板示例

`main.js` 与 `manifest.json` 定义了一个最小 UXP 面板示例，它使用 `batchPlay` 添加红色背景层，可作为 UXP 工作流的起点。

## 说明

- `skills/photoshop-jsx-scripting/scripts/run_ps.sh` 依赖 AppleScript，仅支持 macOS。
- `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx` 除 `ping` 之外的命令都需要打开文档。
