---
name: photoshop-jsx-scripting
description: Automate Adobe Photoshop via ExtendScript/JSX, inspect documents/layers, and build command-driven workflows (ps_agent.jsx/ps_call.sh). Use when you need Photoshop scripting APIs, DOM/Action Manager references, or to add new Photoshop commands in this repo.
---

# Photoshop JSX Scripting

## Overview
Use this skill to drive Photoshop with ExtendScript/JSX, look up DOM objects/methods/constants, and add new command handlers to the local ps_agent bridge.

## Quick start (this repo)
- Run a command through the bridge: `./skills/photoshop-jsx-scripting/scripts/ps_call.sh '{"command":"ping"}'`
- Read responses from: `skills/photoshop-jsx-scripting/scripts/ps_response.json`
- Add or update commands in: `skills/photoshop-jsx-scripting/scripts/ps_agent.jsx`
- Route natural-language instructions: `./skills/photoshop-jsx-scripting/scripts/ps_nl.sh "create a 1200x800 RGB document"`
  - Override the LLM command with `PS_LLM_CMD` (defaults to `codex exec` if available).

## Built-in commands
- `ping` (health check)
- `create_document` (requires params)
- `open_document` (requires params)
- `get_document_info`
- `list_layers`
- `list_fonts`
- `save_active_document`
- `save_active_document_as` (requires params)
- `close_active_document` (optional params)
- `duplicate_active_document` (optional params)
- `flatten_active_document`
- `resize_image` (requires params)
- `resize_canvas` (requires params)
- `rotate_canvas` (requires params)
- `add_empty_layer` (optional params)
- `add_text_layer` (requires params)
- `add_paragraph_text_layer` (requires params)
- `update_text_layer` (requires params)
- `fit_text_to_box` (requires params)
- `merge_active_down`
- `merge_visible_layers`
- `duplicate_active_layer` (requires params)
- `delete_active_layer`
- `rename_active_layer` (requires params)
- `set_active_layer_visibility` (requires params)
- `set_active_layer_opacity` (requires params)
- `set_active_layer_blend_mode` (requires params)
- `select_all`
- `deselect`
- `invert_selection`
- `expand_selection` (requires params)
- `contract_selection` (requires params)
- `feather_selection` (requires params)
- `set_foreground_color` (requires params)
- `add_bezier_path` (requires params)
- `stroke_path` (optional params)
- `delete_path` (optional params)
- `set_active_layer` (requires params)
- `get_layer_bounds` (requires params)
- `check_layer_overlap` (requires params)
- `create_layer_group` (optional params)
- `move_layers_to_group` (requires params)
- `ungroup_layer_group` (optional params)
- `add_levels_adjustment_layer` (optional params)
- `add_curves_adjustment_layer` (optional params)
- `add_hue_saturation_adjustment_layer` (optional params)
- `add_black_white_adjustment_layer` (optional params)
- `add_solid_fill_layer` (optional params)
- `add_gradient_fill_layer` (optional params)
- `add_pattern_fill_layer` (requires params)
- `create_layer_mask` (optional params)
- `apply_layer_mask`
- `delete_layer_mask` (optional params)
- `invert_layer_mask`
- `set_clipping_mask` (requires params)
- `create_clipping_mask`
- `release_clipping_mask`
- `add_shape_rect` (requires params)
- `add_shape_ellipse` (requires params)
- `transform_active_layer` (requires params)
- `flip_active_layer_horizontal`
- `flip_active_layer_vertical`
- `align_layers` (requires params)
- `distribute_layers` (requires params)
- `place_image_as_layer` (requires params)
- `export_document` (requires params)
- `export_preview` (optional params)
- `history_undo`
- `history_redo`
- `apply_layer_style` (requires params)

## JSON params format
Send JSON when a command needs parameters:

```json
{
  "command": "add_text_layer",
  "params": {
    "text": "Hello",
    "font": "ArialMT",
    "size": 48,
    "color": [255, 0, 0],
    "position": [100, 200],
    "name": "Title"
  }
}
```

## Add a new command
1. Identify the DOM class/method/enum in `references/official-docs.md`.
2. If the DOM lacks the capability, capture an Action Manager snippet with ScriptListener (see `references/official-docs.md`).
3. Implement the command in `scripts/ps_agent.jsx` (ExtendScript-compatible; avoid modern JS features).
4. Add JSON output via the local `stringify` helper.
5. Test with `scripts/ps_call.sh` and confirm JSON output.

## Command design guidelines
- Prefer idempotent commands (no destructive edits without explicit parameters).
- For actions that require an open document, enforce the check before running.
- Return structured data (arrays, simple objects) that Codex can parse.

## Design workflow (style-first)
Use this when creating layouts that need visual quality, not just "no overlap".

1) **Pick a style preset**
   - Define palette (3-5 colors), line weights, and a type scale (Title / Subtitle / Body).
   - Keep contrast gentle for stationery; reserve the darkest color for body text only.

2) **Choose fonts intentionally**
   - Use `list_fonts` to see available fonts.
   - Prefer one serif or one humanist sans for body + a bolder companion for title.
   - Keep the number of families to 1-2 max.

3) **Set layout constraints**
   - Establish margins first (e.g., 8-12% of width).
   - Use paragraph text with a defined text box and explicit `leading`.
   - Maintain consistent vertical rhythm (leading ~= 1.4-1.7 x font size).
   - After adding text, call `get_layer_bounds` to ensure the layer stays inside margins.
   - If bounds exceed the canvas, reduce size/leading or shrink the text box.

4) **Add subtle structure**
   - Use thin rules/frames, small accent lines, or a soft watermark.
   - Avoid large blocks; aim for "lightweight decoration".

5) **Quality pass**
   - Run `check_layer_overlap` on key text layers.
   - Export a quick preview with `export_preview` and visually scan for balance.
   - Adjust spacing before tweaking colors.

## Layout math & bounds checking
- **Know the canvas**: get width/height via `get_document_info` and set explicit margins.
- **Units reminder**: text `size/leading` are in points; convert from pixels with `pt = px * 72 / resolution`.
- **Text fit math**: estimate paragraph height as `lines * leading` (lines ~= text box height / leading).
- **Box fit**: ensure `text box height >= (lineCount * leading)` and `text box width` fits margins.
- **Bounds verify**: after placing text, call `get_layer_bounds` and compare against the intended container.
- **Adjust loop**: if overflow, reduce `size` or `leading`, or increase box height/width.
- **Pixel tuning**: nudge position in pixels using updated `position` values.

## Preview-based QA
- **Export preview**: use `export_preview` after key layout steps.
- **Visual check**: scan for overflows, uneven spacing, and off-center alignment.
- **Iterate**: adjust sizes/positions in small px steps (e.g., 8-16px).

## Curved lines & highlights
- **Curved strings**: use `add_bezier_path` with control points, then `stroke_path`.
  - Tip: set brush size/shape in Photoshop before stroking; `stroke_path` uses current tool settings.
- **Shadows / highlights / gradients**: create a layer style in Photoshop and apply it by name with
  `apply_layer_style` (e.g., a "Balloon Glow" style with Gradient Overlay + Inner Shadow).

## Style presets (suggested)
- **Soft Minimal**: warm paper, muted terracotta accents, thin rules, no heavy bars.
- **Vintage Letter**: warm beige + deep brown, subtle frame, faint watermark.
- **Modern Clean**: cool off-white, charcoal text, geometric margins, sparse accents.

## References
- `references/official-docs.md`
- `references/dom-index.md`
- `references/command-catalog.md`
