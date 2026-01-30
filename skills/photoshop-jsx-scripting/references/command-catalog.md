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
  - Response: `{ name, width, height, resolution, mode, colorProfile, profile, bitDepth }`

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

- `add_paragraph_text_layer`
  - Params:
    - `text` (string, required)
    - `boxWidth` (number, required, px)
    - `boxHeight` (number, required, px)
    - `position` (array `[x,y]`, optional)
    - `font` (string, optional, PostScript name)
    - `size` (number, optional)
    - `leading` (number, optional)
    - `tracking` (number, optional)
    - `justification` (string, optional, `LEFT`, `RIGHT`, `CENTER`, `FULLYJUSTIFIED`)
    - `color` (array `[r,g,b]`, optional)
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

## Selections
- `select_all`
  - Params: none
  - Response: `{ selected: "all" }`

- `deselect`
  - Params: none
  - Response: `{ selected: "none" }`

- `invert_selection`
  - Params: none
  - Response: `{ inverted: true }`

- `expand_selection`
  - Params:
    - `amount` (number, required, px)
  - Response: `{ expanded }`

- `contract_selection`
  - Params:
    - `amount` (number, required, px)
  - Response: `{ contracted }`

- `feather_selection`
  - Params:
    - `radius` (number, required, px)
  - Response: `{ feather }`

## Color & paths
- `set_foreground_color`
  - Params:
    - `color` (array `[r,g,b]`, required)
  - Response: `{ color }`

- `add_bezier_path`
  - Params:
    - `points` (array, required; each point has `anchor` `[x,y]`, optional `left` `[x,y]`, `right` `[x,y]`, `kind`)
    - `name` (string, optional)
    - `closed` (boolean, optional)
  - Response: `{ name, points, closed }`

- `stroke_path`
  - Params:
    - `name` (string, optional; uses last path when omitted)
    - `tool` (string, optional; `BRUSH`, `PENCIL`, `ERASER`)
  - Response: `{ stroked, name }`

- `delete_path`
  - Params:
    - `name` (string, optional; uses last path when omitted)
  - Response: `{ deleted, name }`

## Layer utilities
- `set_active_layer`
  - Params:
    - `layerId` (number, optional)
    - `layerName` (string, optional)
  - Response: `{ id, name }`

- `get_layer_bounds`
  - Params:
    - `layerId` (number, optional)
    - `layerName` (string, optional)
  - Response: `{ id, name, bounds }`

- `check_layer_overlap`
  - Params:
    - `layerIds` (array, optional)
    - `layerNames` (array, optional)
    - `padding` (number, optional, px)
  - Response: `{ checked, overlaps }`

- `apply_layer_style`
  - Params:
    - `styleName` (string, required)
  - Response: `{ applied, id }`

## Groups
- `create_layer_group`
  - Params:
    - `name` (string, optional)
  - Response: `{ name, id }`

- `move_layers_to_group`
  - Params:
    - `groupId` (number, optional)
    - `groupName` (string, optional)
    - `layerIds` (array, optional)
    - `layerNames` (array, optional)
  - Response: `{ moved, groupId, groupName }`

- `ungroup_layer_group`
  - Params:
    - `groupId` (number, optional)
    - `groupName` (string, optional)
  - Response: `{ ungrouped, parentName }`

## Adjustment layers
- `add_levels_adjustment_layer`
  - Params:
    - `name` (string, optional)
  - Response: `{ name, id, kind }`

- `add_curves_adjustment_layer`
  - Params:
    - `name` (string, optional)
  - Response: `{ name, id, kind }`

- `add_hue_saturation_adjustment_layer`
  - Params:
    - `name` (string, optional)
  - Response: `{ name, id, kind }`

- `add_black_white_adjustment_layer`
  - Params:
    - `name` (string, optional)
  - Response: `{ name, id, kind }`

## Fill layers
- `add_solid_fill_layer`
  - Params:
    - `name` (string, optional)
    - `color` (array `[r,g,b]`, optional)
  - Response: `{ name, id, kind }`

- `add_gradient_fill_layer`
  - Params:
    - `name` (string, optional)
    - `colors` (array of `[r,g,b]`, optional)
    - `angle` (number, optional)
    - `scale` (number, optional)
    - `type` (string, optional, `LINEAR`, `RADIAL`, `ANGLE`, `REFLECTED`, `DIAMOND`)
  - Response: `{ name, id, kind }`

- `add_pattern_fill_layer`
  - Params:
    - `name` (string, optional)
    - `patternName` (string, required if no `patternId`)
    - `patternId` (string, required if no `patternName`)
    - `scale` (number, optional)
  - Response: `{ name, id, kind }`

## Layer masks
- `create_layer_mask`
  - Params:
    - `fromSelection` (boolean, optional)
  - Response: `{ mask: "created" }`

- `apply_layer_mask`
  - Params: none
  - Response: `{ mask: "applied" }`

- `delete_layer_mask`
  - Params:
    - `apply` (boolean, optional)
  - Response: `{ mask: "deleted" }`

- `invert_layer_mask`
  - Params: none
  - Response: `{ mask: "inverted" }`

## Clipping mask
- `set_clipping_mask`
  - Params:
    - `enabled` (boolean, required)
  - Response: `{ clipping, id }`

- `create_clipping_mask`
  - Params: none
  - Response: `{ clipping, id }`

- `release_clipping_mask`
  - Params: none
  - Response: `{ clipping, id }`

## Shape layers
- `add_shape_rect`
  - Params:
    - `x` (number, required)
    - `y` (number, required)
    - `width` (number, required)
    - `height` (number, required)
    - `color` (array `[r,g,b]`, optional)
    - `name` (string, optional)
  - Response: `{ name, id, kind }`

- `add_shape_ellipse`
  - Params:
    - `x` (number, required)
    - `y` (number, required)
    - `width` (number, required)
    - `height` (number, required)
    - `color` (array `[r,g,b]`, optional)
    - `name` (string, optional)
  - Response: `{ name, id, kind }`

## Transform
- `transform_active_layer`
  - Params:
    - `scaleX` (number, optional, percent)
    - `scaleY` (number, optional, percent)
    - `rotate` (number, optional, degrees)
    - `offsetX` (number, optional, px)
    - `offsetY` (number, optional, px)
  - Response: `{ transformed, id }`

- `flip_active_layer_horizontal`
  - Params: none
  - Response: `{ flipped, id }`

- `flip_active_layer_vertical`
  - Params: none
  - Response: `{ flipped, id }`

## Align / distribute
- `align_layers`
  - Params:
    - `layerIds` (array, required)
    - `mode` (string, optional, `LEFT`, `RIGHT`, `CENTER_HORIZONTAL`, `TOP`, `BOTTOM`, `CENTER_VERTICAL`)
    - `reference` (string, optional, `FIRST`, `DOCUMENT`)
  - Response: `{ aligned, mode }`

- `distribute_layers`
  - Params:
    - `layerIds` (array, required, min 3)
    - `axis` (string, optional, `HORIZONTAL`, `VERTICAL`)
  - Response: `{ distributed, axis }`

## Place / export
- `place_image_as_layer`
  - Params:
    - `path` (string, required)
    - `name` (string, optional)
  - Response: `{ placed, name, id }`

- `export_document`
  - Params:
    - `path` (string, required)
    - `format` (string, required, `png`, `jpg`, `webp`)
    - `quality` (number, optional)
  - Response: `{ exported, path, format }`

- `export_preview`
  - Params:
    - `path` (string, optional, default `/tmp/ps_preview.png`)
    - `format` (string, optional, default `png`)
    - `quality` (number, optional)
  - Response: `{ exported, path, format }`

## History
- `history_undo`
  - Params: none
  - Response: `{ undo: true }`

- `history_redo`
  - Params: none
  - Response: `{ redo: true }`
