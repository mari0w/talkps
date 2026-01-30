# talkps

A lightweight bridge for driving Adobe Photoshop from Codex workflows. The repo includes:

- **ExtendScript/JSX bridge** (`ps_agent.jsx` + `ps_call.sh`) for JSON-in/JSON-out commands.
- **UXP panel sample** (`main.js`, `manifest.json`) showing modern Photoshop plugin usage.
- **Skill package** (`skills/photoshop-jsx-scripting`) with references and workflow guidance.

## Architecture

```
ps_call.sh -> run_ps.sh -> Photoshop -> ps_agent.jsx -> ps_response.json
```

- `ps_call.sh` writes a request JSON, runs `ps_agent.jsx` inside Photoshop, and prints the response.
- `ps_agent.jsx` reads `ps_request.json` from its own directory and writes `ps_response.json` back.
- `run_ps.sh` uses AppleScript (`osascript`) to ask Photoshop to execute the JSX.

## Quick start (JSX bridge)

1. Open Photoshop and keep it running.
2. In this repo, run:

```bash
./ps_call.sh '{"command":"ping"}'
```

3. If you want to inspect the current document:

```bash
./ps_call.sh '{"command":"get_document_info"}'
./ps_call.sh '{"command":"list_layers"}'
```

4. Examples that use parameters (JSON input):

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

### Config overrides

By default the scripts read/write `ps_request.json` and `ps_response.json` next to the scripts. If you need custom paths (for example, when the files live in a synced folder), set:

- `PS_REQUEST_FILE`
- `PS_RESPONSE_FILE`
- `PS_AGENT_JSX`
- `PS_RUNNER`

Example:

```bash
PS_REQUEST_FILE=/path/to/ps_request.json \
PS_RESPONSE_FILE=/path/to/ps_response.json \
./ps_call.sh '{"command":"list_layers"}'
```

## Skill package

The Photoshop skill lives in `skills/photoshop-jsx-scripting`. It documents:

- Where to find official scripting docs.
- How to add new commands to `ps_agent.jsx`.
- How to fall back to Action Manager code when DOM APIs are missing.

## Official documentation sources

These are the primary sources used to map commands to Photoshop scripting APIs:

- Photoshop JavaScript Reference (PDF, 2020): https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551504/1/photoshop-javascript-ref-2020-online2pdf-version.pdf
- Photoshop Scripting Guide (PDF, 2020): https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/551569/1/photoshop-scripting-guide-2020-online2pdf-version.pdf
- Scripting in Photoshop (HelpX): https://helpx.adobe.com/photoshop/using/scripting.html

## UXP sample panel

`main.js` and `manifest.json` define a minimal UXP panel that adds a red background layer using `batchPlay`. Use this as a starting point for UXP-based workflows.

## Notes

- `run_ps.sh` uses AppleScript and is macOS-only.
- `ps_agent.jsx` requires an open document for most commands (except `ping`).
