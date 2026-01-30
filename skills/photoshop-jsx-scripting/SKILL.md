---
name: photoshop-jsx-scripting
description: Automate Adobe Photoshop via ExtendScript/JSX, inspect documents/layers, and build command-driven workflows (ps_agent.jsx/ps_call.sh). Use when you need Photoshop scripting APIs, DOM/Action Manager references, or to add new Photoshop commands in this repo.
---

# Photoshop JSX Scripting

## Overview
Use this skill to drive Photoshop with ExtendScript/JSX, look up DOM objects/methods/constants, and add new command handlers to the local ps_agent bridge.

## Quick start (this repo)
- Run a command through the bridge: `./ps_call.sh '{"command":"ping"}'`
- Read responses from: `ps_response.json`
- Add or update commands in: `ps_agent.jsx`

## Built-in commands
- `ping` (health check)
- `get_document_info`
- `list_layers`
- `list_fonts`
- `add_text_layer` (requires params)
- `merge_active_down`
- `merge_visible_layers`
- `duplicate_active_layer` (requires params)
- `delete_active_layer`
- `rename_active_layer` (requires params)
- `set_active_layer_visibility` (requires params)
- `set_active_layer_opacity` (requires params)

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
3. Implement the command in `ps_agent.jsx` (ExtendScript-compatible; avoid modern JS features).
4. Add JSON output via the local `stringify` helper.
5. Test with `ps_call.sh` and confirm JSON output.

## Command design guidelines
- Prefer idempotent commands (no destructive edits without explicit parameters).
- For actions that require an open document, enforce the check before running.
- Return structured data (arrays, simple objects) that Codex can parse.

## References
- `references/official-docs.md`
- `references/dom-index.md`
- `references/command-catalog.md`
