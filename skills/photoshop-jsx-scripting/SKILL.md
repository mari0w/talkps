---
name: photoshop-jsx-scripting
description: Automate Adobe Photoshop via ExtendScript/JSX, inspect documents/layers, and build command-driven workflows (ps_agent.jsx/ps_call.sh). Use when you need Photoshop scripting APIs, DOM/Action Manager references, or to add new Photoshop commands in this repo.
---

# Photoshop JSX Scripting

## Overview
Use this skill to drive Photoshop with ExtendScript/JSX, look up DOM objects/methods/constants, and add new command handlers to the local ps_agent bridge.

## Quick start (this repo)
- Run a command through the bridge: `/Users/charles/photoshop/ps_call.sh '{"command":"list_layers"}'`
- Read responses from: `/Users/charles/photoshop/ps_response.json`
- Add or update commands in: `/Users/charles/photoshop/ps_agent.jsx`

## Built-in commands
- `get_document_info`
- `list_layers`

## Add a new command
1. Look up the DOM method/property in `references/official-docs.md`.
2. Implement the command in `ps_agent.jsx` (keep it ExtendScript-compatible; avoid modern JS features).
3. Test with `ps_call.sh` and confirm JSON output.

## When DOM is not enough
- Record the action with ScriptListener and translate the Action Manager code into ExtendScript.
- See ScriptListener notes and the Scripting Guide in `references/official-docs.md`.

## Run scripts inside Photoshop
- Use File > Scripts > Browse to run a .jsx file.
- Put .jsx files in Presets/Scripts to show them in the File > Scripts menu.
- Use Script Events Manager to trigger scripts on Photoshop events.

## References
- `references/official-docs.md`
