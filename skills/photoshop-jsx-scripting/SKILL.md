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
- `history_undo`
- `history_redo`

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

## References
- `references/official-docs.md`
- `references/dom-index.md`
- `references/command-catalog.md`
