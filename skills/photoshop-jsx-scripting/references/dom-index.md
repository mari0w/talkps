# Photoshop DOM Index (JSX)

Use this as a quick map of where to search in the JavaScript Reference PDF. It is **not** exhaustive; treat it as a guide for locating the official definitions.

## Core objects
- **Application (`app`)**: open documents, preferences, active tool, color settings.
- **Document**: size, resolution, color mode, history, save/export methods.
- **ArtLayer**: normal layers (pixel, text, adjustment, smart objects).
- **LayerSet**: groups and nested layers.
- **Channel**: RGB/CMYK/alpha channels.
- **Selection**: select/transform/feather/invert.
- **PathItem / SubPathItem / PathPointInfo**: vector paths and selections.
- **TextItem**: text layers and typography options.
- **SmartObject**: linked/embedded smart objects (via ArtLayer methods).

## Common enums/constants
Look for these enums in the Reference to ensure correct values:
- `BlendMode`
- `LayerKind`
- `ColorModel`
- `DocumentMode`
- `SaveOptions`
- `Units`

## Action Manager (when DOM is missing)
- Use ScriptListener to record actions.
- Copy the generated `executeAction`/`ActionDescriptor` code into JSX.
- Keep Action Manager calls isolated inside command handlers so they can be swapped out if DOM support appears later.

## Search tips
- Search the PDF for the exact class name (case-sensitive).
- If a method returns another object, follow its class section for available properties.
- Keep a local snippet of the method signature in the command handler comments for quick reference.
