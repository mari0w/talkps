# talkps

[English](README.md) | [简体中文](README.zh-CN.md)

A lightweight bridge for driving Adobe Photoshop from Codex workflows. The repo includes:

- **ExtendScript/JSX bridge** (`skills/photoshop-jsx-scripting/scripts/ps_agent.jsx` + `skills/photoshop-jsx-scripting/scripts/ps_call.sh`) for JSON-in/JSON-out commands.
- **UXP panel sample** (`main.js`, `manifest.json`) showing modern Photoshop plugin usage.
- **Skill package** (`skills/photoshop-jsx-scripting`) with references and workflow guidance.

## Architecture

```
ps_call.sh -> run_ps.sh -> Photoshop -> ps_agent.jsx -> ps_response.json
```

- `skills/photoshop-jsx-scripting/scripts/ps_call.sh` writes a request JSON, runs `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx` inside Photoshop, and prints the response.
- `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx` reads `skills/photoshop-jsx-scripting/scripts/ps_request.json` from its own directory and writes `skills/photoshop-jsx-scripting/scripts/ps_response.json` back.
- `skills/photoshop-jsx-scripting/scripts/run_ps.sh` uses AppleScript (`osascript`) to ask Photoshop to execute the JSX.

## Quick start (JSX bridge)

1. Open Photoshop and keep it running.
2. In this repo, run:

```bash
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"ping"}'
```

This `ping` command checks that Photoshop can execute the JSX bridge and that the JSON request/response loop is working.

3. If you want to inspect the current document:

```bash
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"get_document_info"}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"list_layers"}'
```

4. Examples that use parameters (JSON input):

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
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"create_layers_bulk","params":{"layers":[{"name":"BG","kind":"empty"},{"name":"Title","kind":"text","text":"Hello","font":"ArialMT","size":48,"color":[255,255,255],"position":[120,140]}]}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"set_text_bulk","params":{"items":[{"layerName":"Title","text":"Updated title","size":56},{"layerName":"Subtitle","text":"Second line","size":28,"leading":34}]}}'
./skills/photoshop-jsx-scripting/scripts/ps_call.sh "{\"command\":\"apply_layer_styles_bulk\",\"params\":{\"styles\":[{\"layerName\":\"Title\",\"style\":{\"dropShadow\":{\"opacity\":50,\"distance\":10,\"size\":14,\"angle\":120,\"color\":[0,0,0]}}}]}}"
./skills/photoshop-jsx-scripting/scripts/ps_call.sh "{\"command\":\"batch_commands\",\"params\":{\"continueOnError\":true,\"commands\":[{\"command\":\"add_empty_layer\",\"params\":{\"name\":\"Base\"}},{\"command\":\"add_text_layer\",\"params\":{\"name\":\"Title\",\"text\":\"Batch title\",\"font\":\"ArialMT\",\"size\":48,\"color\":[20,20,20],\"position\":[120,140]}},{\"command\":\"set_layer_style\",\"params\":{\"layerName\":\"Title\",\"dropShadow\":{\"opacity\":50,\"distance\":10,\"size\":14,\"angle\":120,\"color\":[0,0,0]}}}]}}"
```

Example command meanings:
- `create_document`: Create a new document with size, mode, and fill settings.
- `get_document_info`: Return the active document's size, mode, and other metadata.
- `list_layers`: List layer names, IDs, and visibility in the active document.
- `add_text_layer`: Add a new text layer with the provided content and styling.
- `add_text_layer_auto`: Add an auto-layout text layer that fits within a box.
- `add_empty_layer`: Add a blank raster layer (optionally named).
- `merge_active_down`: Merge the active layer with the layer below it.
- `merge_visible_layers`: Merge all currently visible layers into one.
- `list_fonts`: Return the list of available fonts.
- `duplicate_active_layer`: Duplicate the active layer (optionally with a new name).
- `rename_active_layer`: Rename the active layer.
- `set_active_layer_visibility`: Show or hide the active layer.
- `set_active_layer_opacity`: Change the active layer opacity (0-100).
- `set_active_layer_blend_mode`: Set the active layer blend mode.
- `resize_image`: Resize pixel dimensions and/or resolution.
- `resize_canvas`: Resize the canvas with a specific anchor position.
- `rotate_canvas`: Rotate the canvas by degrees.
- `save_active_document_as`: Save the active document to a specific file format.
- `delete_active_layer`: Delete the active layer.
- `create_layers_bulk`: Create multiple empty/text layers in sequence.
- `set_text_bulk`: Update multiple text layers with new content and styling.
- `apply_layer_styles_bulk`: Apply layer styles to multiple layers.
- `batch_commands`: Run a list of commands sequentially and collect results.

## 自然语言入口 / Natural Language Entry

Use the natural-language router to translate a free-form instruction into a command and run it:

```bash
./skills/photoshop-jsx-scripting/scripts/ps_nl.sh "create a 1200x800 RGB document named Hero"
```

Override the LLM command with `PS_LLM_CMD` (defaults to `codex exec` if available):

```bash
PS_LLM_CMD="codex exec" ./skills/photoshop-jsx-scripting/scripts/ps_nl.sh "list layers"
```

> **Note:** If `codex` isn't installed, you must set `PS_LLM_CMD` to another LLM command that prints JSON only.

### Config overrides

By default the scripts now use temporary files in `/tmp` for `ps_request`/`ps_response` (to avoid collisions). If you need fixed paths (for example, when the files live in a synced folder), set:

- `PS_REQUEST_FILE`
- `PS_RESPONSE_FILE`
- `PS_AGENT_JSX`
- `PS_RUNNER`

Example:

```bash
PS_REQUEST_FILE=/path/to/ps_request.json \
PS_RESPONSE_FILE=/path/to/ps_response.json \
./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"list_layers"}'
```

## Skill package

The Photoshop skill lives in `skills/photoshop-jsx-scripting`. It documents:

- Where to find official scripting docs.
- How to add new commands to `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx`.
- How to fall back to Action Manager code when DOM APIs are missing.

## Supported operations (current)

These are the Photoshop operations currently implemented in `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx`:

**Health & inspection**
- `ping` (verify the JSX bridge and JSON request/response loop)
- `get_document_info` (document size, mode, and metadata)
- `list_layers` (layer list with IDs and visibility)
- `list_fonts` (list available fonts)

**Document management**
- `create_document` (create a new document)
- `open_document` (open an existing document)
- `save_active_document` (save current document)
- `save_active_document_as` (save to a specific format/path)
- `close_active_document` (close with save options)
- `duplicate_active_document` (duplicate the active document)
- `flatten_active_document` (flatten layers into background)
- `resize_image` (resize pixel dimensions/resolution)
- `resize_canvas` (resize the canvas)
- `rotate_canvas` (rotate the canvas)

**Text**
- `add_text_layer` (set text content, font, size, color, position)
- `measure_text_bounds` (measure text width/height via bounds)
- `add_text_layer_auto` (auto-fit text inside a box)
- `fit_text_to_box` (auto-size an existing text layer inside a box)

**Layer management**
- `add_empty_layer` (add a blank raster layer)
- `merge_active_down` (merge the active layer with the layer beneath it)
- `merge_visible_layers` (merge all visible layers)
- `duplicate_active_layer` (duplicate the active layer)
- `delete_active_layer` (delete the active layer)
- `rename_active_layer` (rename the active layer)
- `set_active_layer_visibility` (toggle visibility for the active layer)
- `set_active_layer_opacity` (set the active layer opacity)
- `set_active_layer_blend_mode` (set the active layer blend mode)
- `set_layer_style` (set layer effects like shadows, glows, strokes, overlays)

**Batch & bulk**
- `batch_commands` (run multiple commands sequentially, collecting results)
- `create_layers_bulk` (create multiple empty/text layers)
- `set_text_bulk` (update multiple text layers)
- `apply_layer_styles_bulk` (apply layer styles to multiple layers)

## Official documentation sources

These are the primary sources used to map commands to Photoshop scripting APIs:

- Photoshop JavaScript Reference (PDF, 2020): https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551504/1/photoshop-javascript-ref-2020-online2pdf-version.pdf
- Photoshop Scripting Guide (PDF, 2020): https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551569/1/photoshop-scripting-guide-2020-online2pdf-version.pdf
- Scripting in Photoshop (HelpX): https://helpx.adobe.com/photoshop/using/scripting.html

## UXP sample panel

`main.js` and `manifest.json` define a minimal UXP panel that adds a red background layer using `batchPlay`. Use this as a starting point for UXP-based workflows.

## Notes

- `skills/photoshop-jsx-scripting/scripts/run_ps.sh` uses AppleScript and is macOS-only.
- `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx` requires an open document for most commands (except `ping`).
