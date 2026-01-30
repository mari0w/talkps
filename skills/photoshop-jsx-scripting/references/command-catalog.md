# Command Catalog (ps_agent.jsx)

Use this table to design requests and responses for the JSX bridge.

## Basic commands
- `ping`
  - Params: none
  - Response: `{ status: "ok", message: "pong" }`

- `create_document`
  - Params:
    - `width` (number, required, px)
    - `height` (number, required, px)
    - `resolution` (number, optional, default 72)
    - `name` (string, optional)
    - `mode` (string, optional, e.g. `RGB`, `CMYK`, `GRAYSCALE`)
    - `fill` (string, optional, `WHITE`, `TRANSPARENT`, `BACKGROUND`)
  - Response: document info `{ name, width, height, resolution, mode, colorProfile }`

- `open_document`
  - Params:
    - `path` (string, required)
  - Response: document info `{ name, width, height, resolution, mode, colorProfile }`

- `get_document_info`
  - Params: none
  - Response: `{ name, width, height, resolution, mode, colorProfile }`

- `list_layers`
  - Params: none
  - Response: array of layer/group objects (recursive)

- `list_fonts`
  - Params: none
  - Response: array of `{ name, family, style, postScriptName }`

## Document commands
- `save_active_document`
  - Params: none
  - Response: `{ saved: true, name }`

- `save_active_document_as`
  - Params:
    - `path` (string, required)
    - `format` (string, optional, `psd`, `png`, `jpg`)
    - `quality` (number, optional, JPEG 0-12)
    - `asCopy` (boolean, optional)
  - Response: `{ saved: true, name, path }`

- `close_active_document`
  - Params:
    - `save` (string, optional, `SAVECHANGES`, `DONOTSAVECHANGES`, `PROMPTTOSAVECHANGES`)
  - Response: `{ closed: true }`

- `duplicate_active_document`
  - Params:
    - `name` (string, optional)
  - Response: `{ name, id }`

- `flatten_active_document`
  - Params: none
  - Response: `{ flattened: true }`

- `resize_image`
  - Params:
    - `width` (number, optional, px)
    - `height` (number, optional, px)
    - `resolution` (number, optional)
    - `resample` (string, optional, e.g. `BICUBIC`, `BICUBICSMOOTHER`, `NEARESTNEIGHBOR`)
  - Response: document info `{ name, width, height, resolution, mode, colorProfile }`

- `resize_canvas`
  - Params:
    - `width` (number, required, px)
    - `height` (number, required, px)
    - `anchor` (string, optional, e.g. `MIDDLECENTER`, `TOPLEFT`)
  - Response: document info `{ name, width, height, resolution, mode, colorProfile }`

- `rotate_canvas`
  - Params:
    - `angle` (number, required)
  - Response: document info `{ name, width, height, resolution, mode, colorProfile }`

## Editing commands
- `add_empty_layer`
  - Params:
    - `name` (string, optional)
  - Response: `{ name, id }`

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

- `set_active_layer_blend_mode`
  - Params:
    - `mode` (string, required, e.g. `MULTIPLY`, `SCREEN`, `OVERLAY`)
  - Response: `{ blendMode, id }`
