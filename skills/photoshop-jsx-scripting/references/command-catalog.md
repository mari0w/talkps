# Command Catalog (ps_agent.jsx)

Use this table to design requests and responses for the JSX bridge.

## Basic commands
- `ping`
  - Params: none
  - Response: `{ status: "ok", message: "pong" }`

- `get_document_info`
  - Params: none
  - Response: `{ name, width, height, resolution, mode, colorProfile }`

- `list_layers`
  - Params: none
  - Response: array of layer/group objects (recursive)

- `list_fonts`
  - Params: none
  - Response: array of `{ name, family, style, postScriptName }`

## Editing commands
- `add_text_layer`
  - Params:
    - `text` (string, required)
    - `font` (string, optional, PostScript name)
    - `size` (number, optional)
    - `color` (array `[r,g,b]`, optional)
    - `position` (array `[x,y]`, optional)
    - `name` (string, optional)
  - Response: `{ name, id }`

- `merge_active_down`
  - Params: none
  - Response: `{ name, id }`

- `merge_visible_layers`
  - Params: none
  - Response: `{ merged: true }`

- `duplicate_active_layer`
  - Params:
    - `name` (string, optional)
  - Response: `{ name, id }`

- `delete_active_layer`
  - Params: none
  - Response: `{ name, id, deleted: true }`

- `rename_active_layer`
  - Params:
    - `name` (string, required)
  - Response: `{ name, id }`

- `set_active_layer_visibility`
  - Params:
    - `visible` (boolean, required)
  - Response: `{ visible, id }`

- `set_active_layer_opacity`
  - Params:
    - `opacity` (number, required, 0-100)
  - Response: `{ opacity, id }`
