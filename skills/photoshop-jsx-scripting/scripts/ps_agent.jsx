#target photoshop

var __psAgentArgs = (typeof arguments !== "undefined") ? arguments : [];

(function (psArgs) {
    var scriptFile = new File($.fileName);
    var baseDir = scriptFile.parent;
    var argRequestPath = null;
    var argResponsePath = null;
    try {
        if (psArgs && psArgs.length) {
            if (psArgs.length >= 1 && psArgs[0]) {
                argRequestPath = String(psArgs[0]);
            }
            if (psArgs.length >= 2 && psArgs[1]) {
                argResponsePath = String(psArgs[1]);
            }
        }
    } catch (e) {
    }

    var requestPath = argRequestPath || $.getenv("PS_REQUEST_FILE") || (baseDir.fsName + "/ps_request.json");
    var responsePath = argResponsePath || $.getenv("PS_RESPONSE_FILE") || (baseDir.fsName + "/ps_response.json");

    function readFile(path) {
        var f = new File(path);
        if (!f.exists) {
            throw new Error("Request file not found: " + path);
        }
        if (!f.open("r")) {
            throw new Error("Failed to open request file: " + path);
        }
        var content = f.read();
        f.close();
        return content;
    }

    function writeFile(path, content) {
        var f = new File(path);
        if (!f.open("w")) {
            throw new Error("Failed to open response file: " + path);
        }
        f.write(content);
        f.close();
    }

    function trim(s) {
        return s.replace(/^\s+|\s+$/g, "");
    }

    function normalizeTextContent(value) {
        if (value === null || typeof value === "undefined") {
            return value;
        }
        return String(value).replace(/\r\n/g, "\r").replace(/\n/g, "\r");
    }

    function isWhitespace(ch) {
        return ch === " " || ch === "\\n" || ch === "\\r" || ch === "\\t";
    }

    function extractJsonCommand(s) {
        var key = "\"command\"";
        var idx = s.indexOf(key);
        if (idx === -1) {
            return null;
        }
        var colon = s.indexOf(":", idx + key.length);
        if (colon === -1) {
            return null;
        }
        var i = colon + 1;
        while (i < s.length && isWhitespace(s.charAt(i))) {
            i++;
        }
        if (i >= s.length || s.charAt(i) !== "\"") {
            return null;
        }
        i++; // skip opening quote
        var out = "";
        while (i < s.length) {
            var ch = s.charAt(i);
            if (ch === "\\\\") {
                // Skip escaped char
                if (i + 1 < s.length) {
                    out += s.charAt(i + 1);
                    i += 2;
                    continue;
                }
            }
            if (ch === "\"") {
                return out;
            }
            out += ch;
            i++;
        }
        return null;
    }

    function parseRequest(raw) {
        var s = trim(raw);
        if (s === "") {
            return { command: null, params: {} };
        }
        if (s.charAt(0) === "{") {
            if (typeof JSON !== "undefined" && JSON.parse) {
                try {
                    var parsed = JSON.parse(s);
                    return {
                        command: parsed.command || null,
                        params: parsed.params || {}
                    };
                } catch (err) {
                    // Fall back to eval parsing below.
                }
            }
            try {
                var evaluated = eval("(" + s + ")");
                if (evaluated && typeof evaluated === "object") {
                    return {
                        command: evaluated.command || null,
                        params: evaluated.params || {}
                    };
                }
            } catch (err2) {
                // Fall back to string parsing below.
            }
        }
        // Try JSON-style: {"command":"list_layers"}
        var jsonCmd = extractJsonCommand(s);
        if (jsonCmd) {
            return { command: jsonCmd, params: {} };
        }
        // Try simple style: command=list_layers
        if (s.indexOf("command=") === 0) {
            return { command: trim(s.substring(8)), params: {} };
        }
        return { command: s, params: {} };
    }

    function escapeString(s) {
        return s
            .replace(/\\/g, "\\\\")
            .replace(/\"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t");
    }

    function isArray(value) {
        return value && value.constructor === Array;
    }

    function resolveColorArray(value, fallback) {
        if (value && value.length === 3) {
            return [value[0], value[1], value[2]];
        }
        return fallback ? [fallback[0], fallback[1], fallback[2]] : [0, 0, 0];
    }

    function rgbArrayToSolidColor(value, fallback) {
        var rgb = resolveColorArray(value, fallback);
        var c = new SolidColor();
        c.rgb.red = rgb[0];
        c.rgb.green = rgb[1];
        c.rgb.blue = rgb[2];
        return c;
    }

    function rgbArrayToDescriptor(value, fallback) {
        var rgb = resolveColorArray(value, fallback);
        var desc = new ActionDescriptor();
        desc.putDouble(cID("Rd  "), rgb[0]);
        desc.putDouble(cID("Grn "), rgb[1]);
        desc.putDouble(cID("Bl  "), rgb[2]);
        return desc;
    }

    function stringify(value) {
        if (value === null || value === undefined) {
            return "null";
        }
        var t = typeof value;
        if (t === "string") {
            return "\"" + escapeString(value) + "\"";
        }
        if (t === "number" || t === "boolean") {
            return String(value);
        }
        if (isArray(value)) {
            var parts = [];
            for (var i = 0; i < value.length; i++) {
                parts.push(stringify(value[i]));
            }
            return "[" + parts.join(",") + "]";
        }
        if (t === "object") {
            var items = [];
            for (var k in value) {
                if (value.hasOwnProperty(k)) {
                    items.push("\"" + escapeString(k) + "\":" + stringify(value[k]));
                }
            }
            return "{" + items.join(",") + "}";
        }
        return "null";
    }

    function cID(value) {
        return charIDToTypeID(value);
    }

    function sID(value) {
        return stringIDToTypeID(value);
    }

    function boundsToArray(b) {
        return [
            b[0].as("px"),
            b[1].as("px"),
            b[2].as("px"),
            b[3].as("px")
        ];
    }

    function layerToObject(layer) {
        if (layer.typename === "LayerSet") {
            var children = [];
            for (var i = 0; i < layer.layers.length; i++) {
                children.push(layerToObject(layer.layers[i]));
            }
            return {
                type: "group",
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode ? layer.blendMode.toString() : null,
                bounds: layer.bounds ? boundsToArray(layer.bounds) : null,
                children: children
            };
        }

        return {
            type: "layer",
            name: layer.name,
            kind: layer.kind ? layer.kind.toString() : null,
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: layer.blendMode ? layer.blendMode.toString() : null,
            bounds: layer.bounds ? boundsToArray(layer.bounds) : null
        };
    }

    function listLayers(doc) {
        var items = [];
        for (var i = 0; i < doc.layers.length; i++) {
            items.push(layerToObject(doc.layers[i]));
        }
        return items;
    }

    function getDocumentInfo(doc) {
        return {
            name: doc.name,
            width: doc.width.as("px"),
            height: doc.height.as("px"),
            resolution: doc.resolution,
            mode: String(doc.mode),
            colorProfile: doc.colorProfileName,
            profile: doc.colorProfileName,
            bitDepth: mapBitsPerChannel(doc.bitsPerChannel)
        };
    }

    function listFonts() {
        var fonts = [];
        for (var i = 0; i < app.fonts.length; i++) {
            var f = app.fonts[i];
            fonts.push({
                name: f.name,
                family: f.family,
                style: f.style,
                postScriptName: f.postScriptName
            });
        }
        return fonts;
    }

    function toUnitValue(value, unit) {
        if (value === undefined || value === null) {
            return undefined;
        }
        if (value.constructor === UnitValue) {
            return value;
        }
        return new UnitValue(value, unit);
    }

    function normalizeEnumKey(value) {
        if (!value || typeof value !== "string") {
            return null;
        }
        return value.replace(/\s+/g, "_").replace(/-/g, "_").toUpperCase();
    }

    function mapNewDocumentMode(value) {
        var key = normalizeEnumKey(value);
        if (!key) {
            return NewDocumentMode.RGB;
        }
        if (NewDocumentMode[key]) {
            return NewDocumentMode[key];
        }
        throw new Error("Unsupported document mode: " + value);
    }

    function mapDocumentFill(value) {
        var key = normalizeEnumKey(value);
        if (!key) {
            return DocumentFill.WHITE;
        }
        if (DocumentFill[key]) {
            return DocumentFill[key];
        }
        throw new Error("Unsupported document fill: " + value);
    }

    function mapSaveOptions(value) {
        var key = normalizeEnumKey(value);
        if (!key) {
            return SaveOptions.PROMPTTOSAVECHANGES;
        }
        if (SaveOptions[key]) {
            return SaveOptions[key];
        }
        throw new Error("Unsupported save option: " + value);
    }

    function mapBlendMode(value) {
        var key = normalizeEnumKey(value);
        if (!key) {
            throw new Error("Missing blend mode");
        }
        if (BlendMode[key]) {
            return BlendMode[key];
        }
        throw new Error("Unsupported blend mode: " + value);
    }

    function mapBlendModeToTypeId(value) {
        var key = normalizeEnumKey(value || "NORMAL");
        if (key === "NORMAL") { return sID("normal"); }
        if (key === "MULTIPLY") { return sID("multiply"); }
        if (key === "SCREEN") { return sID("screen"); }
        if (key === "OVERLAY") { return sID("overlay"); }
        if (key === "SOFT_LIGHT") { return sID("softLight"); }
        if (key === "HARD_LIGHT") { return sID("hardLight"); }
        if (key === "COLOR_DODGE") { return sID("colorDodge"); }
        if (key === "COLOR_BURN") { return sID("colorBurn"); }
        if (key === "LINEAR_DODGE" || key === "ADD") { return sID("linearDodge"); }
        if (key === "LINEAR_BURN") { return sID("linearBurn"); }
        if (key === "VIVID_LIGHT") { return sID("vividLight"); }
        if (key === "LINEAR_LIGHT") { return sID("linearLight"); }
        if (key === "PIN_LIGHT") { return sID("pinLight"); }
        if (key === "HARD_MIX") { return sID("hardMix"); }
        if (key === "DIFFERENCE") { return sID("difference"); }
        if (key === "EXCLUSION") { return sID("exclusion"); }
        if (key === "HUE") { return sID("hue"); }
        if (key === "SATURATION") { return sID("saturation"); }
        if (key === "COLOR") { return sID("color"); }
        if (key === "LUMINOSITY") { return sID("luminosity"); }
        if (key === "DARKEN") { return sID("darken"); }
        if (key === "LIGHTEN") { return sID("lighten"); }
        if (key === "DARKEN_COLOR") { return sID("darkerColor"); }
        if (key === "LIGHTEN_COLOR") { return sID("lighterColor"); }
        if (key === "DISSOLVE") { return sID("dissolve"); }
        return sID("normal");
    }

    function mapResampleMethod(value) {
        var key = normalizeEnumKey(value);
        if (!key) {
            return ResampleMethod.BICUBIC;
        }
        if (ResampleMethod[key]) {
            return ResampleMethod[key];
        }
        throw new Error("Unsupported resample method: " + value);
    }

    function mapAnchorPosition(value) {
        var key = normalizeEnumKey(value);
        if (!key) {
            return AnchorPosition.MIDDLECENTER;
        }
        if (AnchorPosition[key]) {
            return AnchorPosition[key];
        }
        throw new Error("Unsupported anchor position: " + value);
    }

    function mapJustification(value) {
        var key = normalizeEnumKey(value);
        if (!key) {
            return null;
        }
        if (key === "LEFT" || key === "LEFTJUSTIFIED") {
            return Justification.LEFT;
        }
        if (key === "RIGHT" || key === "RIGHTJUSTIFIED") {
            return Justification.RIGHT;
        }
        if (key === "CENTER" || key === "CENTERJUSTIFIED") {
            return Justification.CENTER;
        }
        if (key === "FULL" || key === "JUSTIFY" || key === "FULLYJUSTIFIED") {
            return Justification.FULLYJUSTIFIED;
        }
        throw new Error("Unsupported justification: " + value);
    }

    function mapBitsPerChannel(value) {
        if (!value) {
            return null;
        }
        if (value === BitsPerChannelType.ONE) {
            return 1;
        }
        if (value === BitsPerChannelType.EIGHT) {
            return 8;
        }
        if (value === BitsPerChannelType.SIXTEEN) {
            return 16;
        }
        if (value === BitsPerChannelType.THIRTYTWO) {
            return 32;
        }
        return null;
    }

    function findLayerById(container, id) {
        for (var i = 0; i < container.layers.length; i++) {
            var layer = container.layers[i];
            if (layer.id === id) {
                return layer;
            }
            if (layer.typename === "LayerSet") {
                var found = findLayerById(layer, id);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    function findLayerByName(container, name, wantGroup) {
        for (var i = 0; i < container.layers.length; i++) {
            var layer = container.layers[i];
            if (layer.name === name) {
                if (!wantGroup || layer.typename === "LayerSet") {
                    return layer;
                }
            }
            if (layer.typename === "LayerSet") {
                var found = findLayerByName(layer, name, wantGroup);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    function findLayerByNameAny(container, name) {
        var layer = findLayerByName(container, name, false);
        if (layer) {
            return layer;
        }
        return findLayerByName(container, name, true);
    }

    function resolveLayerFromParams(doc, params) {
        if (params && typeof params.layerId !== "undefined") {
            return findLayerById(doc, params.layerId);
        }
        if (params && params.layerName) {
            return findLayerByNameAny(doc, params.layerName);
        }
        return doc.activeLayer;
    }

    function getLayerBoundsPx(layer) {
        return [
            layer.bounds[0].as("px"),
            layer.bounds[1].as("px"),
            layer.bounds[2].as("px"),
            layer.bounds[3].as("px")
        ];
    }

    function expandBounds(bounds, amount) {
        if (!amount) {
            return bounds;
        }
        return [
            bounds[0] - amount,
            bounds[1] - amount,
            bounds[2] + amount,
            bounds[3] + amount
        ];
    }

    function boundsIntersection(a, b) {
        var left = Math.max(a[0], b[0]);
        var top = Math.max(a[1], b[1]);
        var right = Math.min(a[2], b[2]);
        var bottom = Math.min(a[3], b[3]);
        if (right <= left || bottom <= top) {
            return null;
        }
        return [left, top, right, bottom];
    }

    function createSelectionAll(doc) {
        doc.selection.selectAll();
        return { selected: "all" };
    }

    function deselectSelection(doc) {
        doc.selection.deselect();
        return { selected: "none" };
    }

    function invertSelection(doc) {
        doc.selection.invert();
        return { inverted: true };
    }

    function expandSelection(doc, params) {
        if (!params || typeof params.amount === "undefined") {
            throw new Error("Missing params.amount");
        }
        doc.selection.expand(params.amount);
        return { expanded: params.amount };
    }

    function contractSelection(doc, params) {
        if (!params || typeof params.amount === "undefined") {
            throw new Error("Missing params.amount");
        }
        doc.selection.contract(params.amount);
        return { contracted: params.amount };
    }

    function featherSelection(doc, params) {
        if (!params || typeof params.radius === "undefined") {
            throw new Error("Missing params.radius");
        }
        doc.selection.feather(params.radius);
        return { feather: params.radius };
    }

    function setForegroundColor(params) {
        if (!params || !params.color || params.color.length !== 3) {
            throw new Error("Missing params.color");
        }
        var c = rgbArrayToSolidColor(params.color, [0, 0, 0]);
        app.foregroundColor = c;
        return { color: [c.rgb.red, c.rgb.green, c.rgb.blue] };
    }

    function mapPointKind(value) {
        if (!value || typeof value !== "string") {
            return PointKind.SMOOTHPOINT;
        }
        var key = normalizeEnumKey(value);
        if (key === "CORNER" || key === "CORNERPOINT") {
            return PointKind.CORNERPOINT;
        }
        return PointKind.SMOOTHPOINT;
    }

    function mapToolType(value) {
        if (!value || typeof value !== "string") {
            return ToolType.BRUSH;
        }
        var key = normalizeEnumKey(value);
        if (key === "PENCIL") {
            return ToolType.PENCIL;
        }
        if (key === "ERASER") {
            return ToolType.ERASER;
        }
        return ToolType.BRUSH;
    }

    function addBezierPath(doc, params) {
        if (!params || !params.points || params.points.length < 2) {
            throw new Error("Missing params.points (>=2)");
        }
        var name = params.name || "Bezier Path";
        var subPath = new SubPathInfo();
        subPath.closed = params.closed ? true : false;
        subPath.operation = ShapeOperation.SHAPEADD;

        var pointInfos = [];
        for (var i = 0; i < params.points.length; i++) {
            var p = params.points[i];
            if (!p || !p.anchor || p.anchor.length !== 2) {
                throw new Error("Point missing anchor");
            }
            var point = new PathPointInfo();
            point.kind = mapPointKind(p.kind);
            point.anchor = [p.anchor[0], p.anchor[1]];
            var left = p.leftDirection || p.left || p.anchor;
            var right = p.rightDirection || p.right || p.anchor;
            point.leftDirection = [left[0], left[1]];
            point.rightDirection = [right[0], right[1]];
            pointInfos.push(point);
        }
        subPath.entireSubPath = pointInfos;

        var pathItem = doc.pathItems.add(name, [subPath]);
        return { name: pathItem.name, points: params.points.length, closed: subPath.closed };
    }

    function resolvePathItem(doc, params) {
        if (params && params.name) {
            if (doc.pathItems.getByName) {
                return doc.pathItems.getByName(params.name);
            }
            for (var i = 0; i < doc.pathItems.length; i++) {
                if (doc.pathItems[i].name === params.name) {
                    return doc.pathItems[i];
                }
            }
        }
        if (doc.pathItems.length > 0) {
            return doc.pathItems[doc.pathItems.length - 1];
        }
        return null;
    }

    function strokePathItem(doc, params) {
        var pathItem = resolvePathItem(doc, params);
        if (!pathItem) {
            throw new Error("Path not found");
        }
        var tool = mapToolType(params && params.tool ? params.tool : null);
        pathItem.strokePath(tool);
        return { stroked: true, name: pathItem.name };
    }

    function deletePathItem(doc, params) {
        var pathItem = resolvePathItem(doc, params);
        if (!pathItem) {
            throw new Error("Path not found");
        }
        var name = pathItem.name;
        pathItem.remove();
        return { deleted: true, name: name };
    }

    function applyLayerStyleByName(doc, params) {
        if (!params || !params.styleName) {
            throw new Error("Missing params.styleName");
        }
        doc.activeLayer.applyStyle(params.styleName);
        return { applied: params.styleName, id: doc.activeLayer.id };
    }

    function resolveBool(value, fallback) {
        if (typeof value === "undefined" || value === null) {
            return fallback;
        }
        return value ? true : false;
    }

    function resolveNumber(value, fallback) {
        if (typeof value === "undefined" || value === null) {
            return fallback;
        }
        return value;
    }

    function putPercent(desc, key, value) {
        if (typeof value !== "undefined" && value !== null) {
            desc.putUnitDouble(sID(key), cID("#Prc"), value);
        }
    }

    function putPixels(desc, key, value) {
        if (typeof value !== "undefined" && value !== null) {
            desc.putUnitDouble(sID(key), cID("#Pxl"), value);
        }
    }

    function putAngle(desc, key, value) {
        if (typeof value !== "undefined" && value !== null) {
            desc.putUnitDouble(sID(key), cID("#Ang"), value);
        }
    }

    function mapGlowTechnique(value) {
        var key = normalizeEnumKey(value || "SOFTER");
        if (key === "PRECISE") {
            return sID("precise");
        }
        return sID("softer");
    }

    function mapGlowSource(value) {
        var key = normalizeEnumKey(value || "EDGE");
        if (key === "CENTER") {
            return sID("center");
        }
        return sID("edge");
    }

    function mapStrokePosition(value) {
        var key = normalizeEnumKey(value || "OUTSIDE");
        if (key === "INSIDE") {
            return sID("insetFrame");
        }
        if (key === "CENTER" || key === "CENTERED") {
            return sID("centeredFrame");
        }
        return sID("outsetFrame");
    }

    function mapGradientType(value) {
        var key = normalizeEnumKey(value || "LINEAR");
        if (key === "RADIAL") {
            return sID("radial");
        }
        if (key === "ANGLE") {
            return sID("angle");
        }
        if (key === "REFLECTED") {
            return sID("reflected");
        }
        if (key === "DIAMOND") {
            return sID("diamond");
        }
        return sID("linear");
    }

    function mapBevelStyle(value) {
        var key = normalizeEnumKey(value || "INNER_BEVEL");
        if (key === "OUTER_BEVEL") { return sID("outerBevel"); }
        if (key === "EMBOSS") { return sID("emboss"); }
        if (key === "PILLOW_EMBOSS") { return sID("pillowEmboss"); }
        if (key === "STROKE_EMBOSS") { return sID("strokeEmboss"); }
        return sID("innerBevel");
    }

    function mapBevelTechnique(value) {
        var key = normalizeEnumKey(value || "SMOOTH");
        if (key === "CHISEL_HARD") { return sID("chiselHard"); }
        if (key === "CHISEL_SOFT") { return sID("chiselSoft"); }
        return sID("smooth");
    }

    function mapBevelDirection(value) {
        var key = normalizeEnumKey(value || "UP");
        if (key === "DOWN") {
            return sID("down");
        }
        return sID("up");
    }

    function buildShadowDescriptor(params, defaults) {
        var p = params || {};
        var d = new ActionDescriptor();
        d.putBoolean(sID("enabled"), resolveBool(p.enabled, defaults.enabled));
        d.putBoolean(sID("present"), true);
        d.putBoolean(sID("showInDialog"), true);
        d.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.blendMode || defaults.blendMode));
        putPercent(d, "opacity", resolveNumber(p.opacity, defaults.opacity));
        putAngle(d, "angle", resolveNumber(p.angle, defaults.angle));
        d.putBoolean(sID("useGlobalAngle"), resolveBool(p.useGlobalAngle, defaults.useGlobalAngle));
        putPixels(d, "distance", resolveNumber(p.distance, defaults.distance));
        var choke = resolveNumber(typeof p.choke !== "undefined" ? p.choke : p.spread, defaults.choke);
        putPercent(d, "chokeMatte", choke);
        putPixels(d, "blur", resolveNumber(p.size, defaults.size));
        putPercent(d, "noise", resolveNumber(p.noise, defaults.noise));
        d.putObject(sID("color"), cID("RGBC"), rgbArrayToDescriptor(p.color, defaults.color));
        return d;
    }

    function buildGlowDescriptor(params, defaults, isInner) {
        var p = params || {};
        var d = new ActionDescriptor();
        d.putBoolean(sID("enabled"), resolveBool(p.enabled, defaults.enabled));
        d.putBoolean(sID("present"), true);
        d.putBoolean(sID("showInDialog"), true);
        d.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.blendMode || defaults.blendMode));
        putPercent(d, "opacity", resolveNumber(p.opacity, defaults.opacity));
        d.putEnumerated(sID("technique"), sID("glowTechnique"), mapGlowTechnique(p.technique || defaults.technique));
        if (isInner) {
            d.putEnumerated(sID("glowSource"), sID("glowSource"), mapGlowSource(p.source || defaults.source));
        }
        var choke = resolveNumber(typeof p.choke !== "undefined" ? p.choke : p.spread, defaults.choke);
        putPercent(d, "chokeMatte", choke);
        putPixels(d, "blur", resolveNumber(p.size, defaults.size));
        putPercent(d, "noise", resolveNumber(p.noise, defaults.noise));
        if (typeof p.range !== "undefined" || typeof defaults.range !== "undefined") {
            putPercent(d, "range", resolveNumber(p.range, defaults.range));
        }
        d.putObject(sID("color"), cID("RGBC"), rgbArrayToDescriptor(p.color, defaults.color));
        return d;
    }

    function buildStrokeDescriptor(params, defaults) {
        var p = params || {};
        var d = new ActionDescriptor();
        d.putBoolean(sID("enabled"), resolveBool(p.enabled, defaults.enabled));
        d.putBoolean(sID("present"), true);
        d.putBoolean(sID("showInDialog"), true);
        d.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.blendMode || defaults.blendMode));
        putPercent(d, "opacity", resolveNumber(p.opacity, defaults.opacity));
        putPixels(d, "size", resolveNumber(p.size, defaults.size));
        d.putEnumerated(sID("style"), sID("frameStyle"), mapStrokePosition(p.position || defaults.position));
        d.putObject(sID("color"), cID("RGBC"), rgbArrayToDescriptor(p.color, defaults.color));
        return d;
    }

    function buildColorOverlayDescriptor(params, defaults) {
        var p = params || {};
        var d = new ActionDescriptor();
        d.putBoolean(sID("enabled"), resolveBool(p.enabled, defaults.enabled));
        d.putBoolean(sID("present"), true);
        d.putBoolean(sID("showInDialog"), true);
        d.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.blendMode || defaults.blendMode));
        putPercent(d, "opacity", resolveNumber(p.opacity, defaults.opacity));
        d.putObject(sID("color"), cID("RGBC"), rgbArrayToDescriptor(p.color, defaults.color));
        return d;
    }

    function buildGradientOverlayDescriptor(params, defaults) {
        var p = params || {};
        var d = new ActionDescriptor();
        d.putBoolean(sID("enabled"), resolveBool(p.enabled, defaults.enabled));
        d.putBoolean(sID("present"), true);
        d.putBoolean(sID("showInDialog"), true);
        d.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.blendMode || defaults.blendMode));
        putPercent(d, "opacity", resolveNumber(p.opacity, defaults.opacity));
        d.putEnumerated(sID("type"), sID("gradientType"), mapGradientType(p.type || defaults.type));
        d.putBoolean(sID("reverse"), resolveBool(p.reverse, defaults.reverse));
        d.putBoolean(sID("dither"), resolveBool(p.dither, defaults.dither));
        d.putBoolean(sID("align"), resolveBool(p.align, defaults.align));
        putAngle(d, "angle", resolveNumber(p.angle, defaults.angle));
        putPercent(d, "scale", resolveNumber(p.scale, defaults.scale));
        d.putObject(sID("gradient"), cID("Grdn"), buildGradientStopsDescriptor(p));
        return d;
    }

    function buildPatternOverlayDescriptor(params, defaults) {
        var p = params || {};
        if (!p.patternName && !p.patternId) {
            throw new Error("Missing patternName/patternId for patternOverlay");
        }
        var d = new ActionDescriptor();
        d.putBoolean(sID("enabled"), resolveBool(p.enabled, defaults.enabled));
        d.putBoolean(sID("present"), true);
        d.putBoolean(sID("showInDialog"), true);
        d.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.blendMode || defaults.blendMode));
        putPercent(d, "opacity", resolveNumber(p.opacity, defaults.opacity));
        var patternDesc = new ActionDescriptor();
        if (p.patternName) {
            patternDesc.putString(cID("Nm  "), p.patternName);
        }
        if (p.patternId) {
            patternDesc.putString(cID("Idnt"), p.patternId);
        }
        d.putObject(sID("pattern"), cID("Ptrn"), patternDesc);
        putPercent(d, "scale", resolveNumber(p.scale, defaults.scale));
        d.putBoolean(sID("align"), resolveBool(p.align, defaults.align));
        return d;
    }

    function buildBevelEmbossDescriptor(params, defaults) {
        var p = params || {};
        var d = new ActionDescriptor();
        d.putBoolean(sID("enabled"), resolveBool(p.enabled, defaults.enabled));
        d.putBoolean(sID("present"), true);
        d.putBoolean(sID("showInDialog"), true);
        d.putEnumerated(sID("style"), sID("bevelStyle"), mapBevelStyle(p.style || defaults.style));
        d.putEnumerated(sID("technique"), sID("bevelTechnique"), mapBevelTechnique(p.technique || defaults.technique));
        d.putEnumerated(sID("direction"), sID("bevelDirection"), mapBevelDirection(p.direction || defaults.direction));
        putPercent(d, "depth", resolveNumber(p.depth, defaults.depth));
        putPixels(d, "size", resolveNumber(p.size, defaults.size));
        putPixels(d, "soften", resolveNumber(p.soften, defaults.soften));
        d.putBoolean(sID("useGlobalAngle"), resolveBool(p.useGlobalAngle, defaults.useGlobalAngle));
        putAngle(d, "angle", resolveNumber(p.angle, defaults.angle));
        putAngle(d, "altitude", resolveNumber(p.altitude, defaults.altitude));

        var highlightMode = new ActionDescriptor();
        highlightMode.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.highlightMode || defaults.highlightMode));
        putPercent(highlightMode, "opacity", resolveNumber(p.highlightOpacity, defaults.highlightOpacity));
        highlightMode.putObject(sID("color"), cID("RGBC"), rgbArrayToDescriptor(p.highlightColor, defaults.highlightColor));
        d.putObject(sID("highlightMode"), sID("highlightMode"), highlightMode);

        var shadowMode = new ActionDescriptor();
        shadowMode.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.shadowMode || defaults.shadowMode));
        putPercent(shadowMode, "opacity", resolveNumber(p.shadowOpacity, defaults.shadowOpacity));
        shadowMode.putObject(sID("color"), cID("RGBC"), rgbArrayToDescriptor(p.shadowColor, defaults.shadowColor));
        d.putObject(sID("shadowMode"), sID("shadowMode"), shadowMode);

        return d;
    }

    function buildBlendingOptionsDescriptor(params, defaults) {
        var p = params || {};
        var d = new ActionDescriptor();
        d.putEnumerated(sID("mode"), sID("blendMode"), mapBlendModeToTypeId(p.blendMode || defaults.blendMode));
        putPercent(d, "opacity", resolveNumber(p.opacity, defaults.opacity));
        if (typeof p.fillOpacity !== "undefined" || typeof defaults.fillOpacity !== "undefined") {
            putPercent(d, "fillOpacity", resolveNumber(p.fillOpacity, defaults.fillOpacity));
        }
        return d;
    }

    function setLayerStyle(doc, params) {
        var layer = resolveLayerFromParams(doc, params);
        if (!layer) {
            throw new Error("Layer not found");
        }
        doc.activeLayer = layer;

        var fxDesc = new ActionDescriptor();
        var hasFx = false;

        var defaults = {
            dropShadow: { enabled: true, opacity: 75, color: [0, 0, 0], size: 5, spread: 0, angle: 120, distance: 5, blendMode: "MULTIPLY", noise: 0, choke: 0, useGlobalAngle: true },
            innerShadow: { enabled: true, opacity: 75, color: [0, 0, 0], size: 5, angle: 120, distance: 5, blendMode: "MULTIPLY", noise: 0, choke: 0, useGlobalAngle: true },
            outerGlow: { enabled: true, opacity: 75, color: [255, 255, 255], size: 5, blendMode: "SCREEN", noise: 0, choke: 0, technique: "SOFTER", range: 50 },
            innerGlow: { enabled: true, opacity: 75, color: [255, 255, 255], size: 5, blendMode: "SCREEN", noise: 0, choke: 0, technique: "SOFTER", source: "EDGE", range: 50 },
            stroke: { enabled: true, opacity: 100, color: [0, 0, 0], size: 1, position: "OUTSIDE", blendMode: "NORMAL" },
            colorOverlay: { enabled: true, opacity: 100, color: [0, 0, 0], blendMode: "NORMAL" },
            gradientOverlay: { enabled: true, opacity: 100, blendMode: "NORMAL", angle: 90, scale: 100, type: "LINEAR", reverse: false, align: true, dither: true },
            patternOverlay: { enabled: true, opacity: 100, blendMode: "NORMAL", scale: 100, align: true },
            bevelEmboss: { enabled: true, style: "INNER_BEVEL", technique: "SMOOTH", direction: "UP", depth: 100, size: 5, soften: 0, angle: 120, altitude: 30, useGlobalAngle: true, highlightMode: "SCREEN", shadowMode: "MULTIPLY", highlightOpacity: 75, shadowOpacity: 75, highlightColor: [255, 255, 255], shadowColor: [0, 0, 0] },
            blendingOptions: { opacity: 100, fillOpacity: 100, blendMode: "NORMAL" }
        };

        if (params && params.dropShadow) {
            fxDesc.putObject(sID("dropShadow"), sID("dropShadow"), buildShadowDescriptor(params.dropShadow, defaults.dropShadow));
            hasFx = true;
        }
        if (params && params.innerShadow) {
            fxDesc.putObject(sID("innerShadow"), sID("innerShadow"), buildShadowDescriptor(params.innerShadow, defaults.innerShadow));
            hasFx = true;
        }
        if (params && params.outerGlow) {
            fxDesc.putObject(sID("outerGlow"), sID("outerGlow"), buildGlowDescriptor(params.outerGlow, defaults.outerGlow, false));
            hasFx = true;
        }
        if (params && params.innerGlow) {
            fxDesc.putObject(sID("innerGlow"), sID("innerGlow"), buildGlowDescriptor(params.innerGlow, defaults.innerGlow, true));
            hasFx = true;
        }
        if (params && params.stroke) {
            fxDesc.putObject(sID("frameFX"), sID("frameFX"), buildStrokeDescriptor(params.stroke, defaults.stroke));
            hasFx = true;
        }
        if (params && params.colorOverlay) {
            fxDesc.putObject(sID("solidFill"), sID("solidFill"), buildColorOverlayDescriptor(params.colorOverlay, defaults.colorOverlay));
            hasFx = true;
        }
        if (params && params.gradientOverlay) {
            fxDesc.putObject(sID("gradientFill"), sID("gradientFill"), buildGradientOverlayDescriptor(params.gradientOverlay, defaults.gradientOverlay));
            hasFx = true;
        }
        if (params && params.patternOverlay) {
            fxDesc.putObject(sID("patternFill"), sID("patternFill"), buildPatternOverlayDescriptor(params.patternOverlay, defaults.patternOverlay));
            hasFx = true;
        }
        if (params && params.bevelEmboss) {
            fxDesc.putObject(sID("bevelEmboss"), sID("bevelEmboss"), buildBevelEmbossDescriptor(params.bevelEmboss, defaults.bevelEmboss));
            hasFx = true;
        }
        if (params && params.blendingOptions) {
            fxDesc.putObject(sID("blendOptions"), sID("blendOptions"), buildBlendingOptionsDescriptor(params.blendingOptions, defaults.blendingOptions));
            hasFx = true;
        }
        if (params && typeof params.scale !== "undefined") {
            putPercent(fxDesc, "scale", params.scale);
        }

        if (!hasFx) {
            throw new Error("No layer style parameters provided");
        }

        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putProperty(cID("Prpr"), sID("layerEffects"));
        ref.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
        desc.putReference(cID("null"), ref);
        desc.putObject(cID("T   "), sID("layerEffects"), fxDesc);
        executeAction(cID("setd"), desc, DialogModes.NO);

        return { id: doc.activeLayer.id, name: doc.activeLayer.name, applied: true };
    }

    function setActiveLayer(doc, params) {
        var layer = resolveLayerFromParams(doc, params);
        if (!layer) {
            throw new Error("Layer not found");
        }
        doc.activeLayer = layer;
        return { id: layer.id, name: layer.name };
    }

    function getLayerBounds(doc, params) {
        var layer = resolveLayerFromParams(doc, params);
        if (!layer) {
            throw new Error("Layer not found");
        }
        return { id: layer.id, name: layer.name, bounds: getLayerBoundsPx(layer) };
    }

    function checkLayerOverlap(doc, params) {
        if (!params || (!params.layerIds && !params.layerNames)) {
            throw new Error("Missing params.layerIds or params.layerNames");
        }
        var layers = [];
        if (params.layerIds && params.layerIds.length) {
            for (var i = 0; i < params.layerIds.length; i++) {
                var byId = findLayerById(doc, params.layerIds[i]);
                if (byId) {
                    layers.push(byId);
                }
            }
        }
        if (params.layerNames && params.layerNames.length) {
            for (var j = 0; j < params.layerNames.length; j++) {
                var byName = findLayerByNameAny(doc, params.layerNames[j]);
                if (byName) {
                    layers.push(byName);
                }
            }
        }
        if (layers.length < 2) {
            throw new Error("Need at least two layers to check overlap");
        }
        var padding = params.padding || 0;
        var overlaps = [];
        for (var a = 0; a < layers.length; a++) {
            for (var b = a + 1; b < layers.length; b++) {
                var boundsA = expandBounds(getLayerBoundsPx(layers[a]), padding);
                var boundsB = expandBounds(getLayerBoundsPx(layers[b]), padding);
                var intersection = boundsIntersection(boundsA, boundsB);
                if (intersection) {
                    overlaps.push({
                        a: { id: layers[a].id, name: layers[a].name, bounds: boundsA },
                        b: { id: layers[b].id, name: layers[b].name, bounds: boundsB },
                        intersection: intersection,
                        area: (intersection[2] - intersection[0]) * (intersection[3] - intersection[1])
                    });
                }
            }
        }
        return { checked: layers.length, overlaps: overlaps };
    }

    function createLayerGroup(doc, params) {
        var group = doc.layerSets.add();
        if (params && params.name) {
            group.name = params.name;
        }
        return { name: group.name, id: group.id };
    }

    function resolveTargetGroup(doc, params) {
        if (params && typeof params.groupId !== "undefined") {
            var byId = findLayerById(doc, params.groupId);
            if (byId && byId.typename === "LayerSet") {
                return byId;
            }
            throw new Error("Group not found for groupId: " + params.groupId);
        }
        if (params && params.groupName) {
            var byName = findLayerByName(doc, params.groupName, true);
            if (byName) {
                return byName;
            }
            throw new Error("Group not found for groupName: " + params.groupName);
        }
        if (doc.activeLayer && doc.activeLayer.typename === "LayerSet") {
            return doc.activeLayer;
        }
        throw new Error("Missing target group (groupId/groupName or active group)");
    }

    function moveLayersIntoGroup(doc, params) {
        var group = resolveTargetGroup(doc, params);
        var layers = [];
        if (params && params.layerIds && params.layerIds.length) {
            for (var i = 0; i < params.layerIds.length; i++) {
                var layer = findLayerById(doc, params.layerIds[i]);
                if (layer) {
                    layers.push(layer);
                }
            }
        } else if (params && params.layerNames && params.layerNames.length) {
            for (var j = 0; j < params.layerNames.length; j++) {
                var layerByName = findLayerByName(doc, params.layerNames[j], false);
                if (layerByName) {
                    layers.push(layerByName);
                }
            }
        } else if (doc.activeLayer && doc.activeLayer !== group) {
            layers.push(doc.activeLayer);
        }

        if (layers.length === 0) {
            throw new Error("No layers found to move into group");
        }

        for (var k = 0; k < layers.length; k++) {
            layers[k].move(group, ElementPlacement.INSIDE);
        }

        return { moved: layers.length, groupId: group.id, groupName: group.name };
    }

    function ungroupLayerGroup(doc, params) {
        var group = resolveTargetGroup(doc, params);
        var parent = group.parent;
        for (var i = group.layers.length - 1; i >= 0; i--) {
            group.layers[i].move(group, ElementPlacement.PLACEAFTER);
        }
        group.remove();
        return { ungrouped: true, parentName: parent ? parent.name : null };
    }

    function addAdjustmentLayer(doc, kind, params) {
        var layer = doc.artLayers.add();
        layer.kind = kind;
        if (params && params.name) {
            layer.name = params.name;
        }
        return { name: layer.name, id: layer.id, kind: layer.kind.toString() };
    }

    function addSolidFillLayer(doc, params) {
        var r = 0, g = 0, b = 0;
        if (params && params.color && params.color.length === 3) {
            r = params.color[0];
            g = params.color[1];
            b = params.color[2];
        }
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(sID("contentLayer"));
        desc.putReference(cID("null"), ref);
        var desc2 = new ActionDescriptor();
        var desc3 = new ActionDescriptor();
        desc3.putDouble(cID("Rd  "), r);
        desc3.putDouble(cID("Grn "), g);
        desc3.putDouble(cID("Bl  "), b);
        desc2.putObject(cID("Clr "), sID("RGBColor"), desc3);
        desc.putObject(cID("Usng"), sID("contentLayer"), desc2);
        executeAction(cID("Mk  "), desc, DialogModes.NO);
        if (params && params.name) {
            doc.activeLayer.name = params.name;
        }
        return { name: doc.activeLayer.name, id: doc.activeLayer.id, kind: "solid" };
    }

    function addLevelsAdjustmentLayer(doc, params) {
        return addAdjustmentLayer(doc, LayerKind.LEVELS, params);
    }

    function addCurvesAdjustmentLayer(doc, params) {
        return addAdjustmentLayer(doc, LayerKind.CURVES, params);
    }

    function addHueSaturationAdjustmentLayer(doc, params) {
        return addAdjustmentLayer(doc, LayerKind.HUESATURATION, params);
    }

    function addBlackWhiteAdjustmentLayer(doc, params) {
        return addAdjustmentLayer(doc, LayerKind.BLACKANDWHITE, params);
    }

    function buildGradientStopsDescriptor(params) {
        var colorStops = [];
        if (params && params.colors && params.colors.length >= 2) {
            colorStops = params.colors;
        } else {
            colorStops = [[0, 0, 0], [255, 255, 255]];
        }

        var gradientDesc = new ActionDescriptor();
        gradientDesc.putString(cID("Nm  "), params && params.name ? params.name : "Custom");
        gradientDesc.putEnumerated(cID("GrdF"), cID("GrdF"), cID("CstS"));
        gradientDesc.putDouble(cID("Intr"), 4096);

        var colorsList = new ActionList();
        for (var i = 0; i < colorStops.length; i++) {
            var stop = new ActionDescriptor();
            var loc = (i === 0) ? 0 : (i === colorStops.length - 1 ? 4096 : Math.round(4096 * (i / (colorStops.length - 1))));
            stop.putInteger(cID("Lctn"), loc);
            stop.putInteger(cID("Mdpn"), 50);
            stop.putObject(cID("Clr "), cID("RGBC"), rgbArrayToDescriptor(colorStops[i], [0, 0, 0]));
            colorsList.putObject(cID("Clrt"), stop);
        }
        gradientDesc.putList(cID("Clrs"), colorsList);

        var transList = new ActionList();
        var t1 = new ActionDescriptor();
        t1.putInteger(cID("Lctn"), 0);
        t1.putInteger(cID("Mdpn"), 50);
        t1.putUnitDouble(cID("Opct"), cID("#Prc"), 100);
        transList.putObject(cID("TrnS"), t1);
        var t2 = new ActionDescriptor();
        t2.putInteger(cID("Lctn"), 4096);
        t2.putInteger(cID("Mdpn"), 50);
        t2.putUnitDouble(cID("Opct"), cID("#Prc"), 100);
        transList.putObject(cID("TrnS"), t2);
        gradientDesc.putList(cID("Trns"), transList);

        return gradientDesc;
    }

    function buildGradientDescriptor(params) {
        var angle = params && typeof params.angle !== "undefined" ? params.angle : 90;
        var scale = params && typeof params.scale !== "undefined" ? params.scale : 100;
        var typeKey = params && params.type ? normalizeEnumKey(params.type) : "LINEAR";
        var typeId = cID("Lnr ");
        if (typeKey === "RADIAL") {
            typeId = cID("Rdl ");
        } else if (typeKey === "ANGLE") {
            typeId = cID("Angl");
        } else if (typeKey === "REFLECTED") {
            typeId = cID("Rflc");
        } else if (typeKey === "DIAMOND") {
            typeId = cID("Dmnd");
        }

        var gradientLayer = new ActionDescriptor();
        gradientLayer.putEnumerated(cID("Type"), cID("GrdT"), typeId);
        gradientLayer.putBoolean(cID("Dthr"), true);
        gradientLayer.putBoolean(cID("Rvrs"), false);
        gradientLayer.putUnitDouble(cID("Angl"), cID("#Ang"), angle);
        gradientLayer.putUnitDouble(cID("Scl "), cID("#Prc"), scale);
        gradientLayer.putObject(cID("Grad"), cID("Grdn"), buildGradientStopsDescriptor(params));
        return gradientLayer;
    }

    function addGradientFillLayer(doc, params) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(sID("contentLayer"));
        desc.putReference(cID("null"), ref);
        var desc2 = new ActionDescriptor();
        var gradientLayer = buildGradientDescriptor(params);
        desc2.putObject(cID("Type"), sID("gradientLayer"), gradientLayer);
        desc.putObject(cID("Usng"), sID("contentLayer"), desc2);
        executeAction(cID("Mk  "), desc, DialogModes.NO);
        if (params && params.name) {
            doc.activeLayer.name = params.name;
        }
        return { name: doc.activeLayer.name, id: doc.activeLayer.id, kind: "gradient" };
    }

    function addPatternFillLayer(doc, params) {
        if (!params || (!params.patternName && !params.patternId)) {
            throw new Error("Missing params.patternName or params.patternId");
        }
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(sID("contentLayer"));
        desc.putReference(cID("null"), ref);
        var desc2 = new ActionDescriptor();
        var patternLayer = new ActionDescriptor();
        var patternDesc = new ActionDescriptor();
        if (params && params.patternName) {
            patternDesc.putString(cID("Nm  "), params.patternName);
        }
        if (params && params.patternId) {
            patternDesc.putString(cID("Idnt"), params.patternId);
        }
        patternLayer.putObject(cID("Ptrn"), cID("Ptrn"), patternDesc);
        var scale = params && typeof params.scale !== "undefined" ? params.scale : 100;
        patternLayer.putUnitDouble(cID("Scl "), cID("#Prc"), scale);
        patternLayer.putBoolean(cID("Algn"), true);
        desc2.putObject(cID("Type"), sID("patternLayer"), patternLayer);
        desc.putObject(cID("Usng"), sID("contentLayer"), desc2);
        executeAction(cID("Mk  "), desc, DialogModes.NO);
        if (params && params.name) {
            doc.activeLayer.name = params.name;
        }
        return { name: doc.activeLayer.name, id: doc.activeLayer.id, kind: "pattern" };
    }

    function createLayerMask(doc, params) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(cID("Chnl"));
        desc.putReference(cID("Nw  "), ref);
        var ref2 = new ActionReference();
        ref2.putEnumerated(cID("Chnl"), cID("Chnl"), cID("Msk "));
        desc.putReference(cID("At  "), ref2);
        var mode = cID("RvlA");
        if (params && params.fromSelection) {
            mode = cID("RvlS");
        }
        desc.putEnumerated(cID("Usng"), cID("UsrM"), mode);
        executeAction(cID("Mk  "), desc, DialogModes.NO);
        return { mask: "created" };
    }

    function deleteLayerMask(doc, params) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(cID("Chnl"), cID("Chnl"), cID("Msk "));
        desc.putReference(cID("null"), ref);
        var apply = params && params.apply ? true : false;
        desc.putBoolean(cID("Aply"), apply);
        executeAction(cID("Dlt "), desc, DialogModes.NO);
        return { mask: apply ? "applied" : "deleted" };
    }

    function applyLayerMask(doc) {
        return deleteLayerMask(doc, { apply: true });
    }

    function invertLayerMask(doc) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(cID("Chnl"), cID("Chnl"), cID("Msk "));
        desc.putReference(cID("null"), ref);
        executeAction(cID("slct"), desc, DialogModes.NO);
        executeAction(cID("Invr"), undefined, DialogModes.NO);
        var rgbDesc = new ActionDescriptor();
        var rgbRef = new ActionReference();
        rgbRef.putEnumerated(cID("Chnl"), cID("Chnl"), cID("RGB "));
        rgbDesc.putReference(cID("null"), rgbRef);
        executeAction(cID("slct"), rgbDesc, DialogModes.NO);
        return { mask: "inverted" };
    }

    function setClippingMask(doc, params) {
        var enabled = params && params.enabled ? true : false;
        doc.activeLayer.grouped = enabled;
        return { clipping: doc.activeLayer.grouped, id: doc.activeLayer.id };
    }

    function addShapeLayerRect(doc, params) {
        if (!params || typeof params.x === "undefined" || typeof params.y === "undefined" ||
            typeof params.width === "undefined" || typeof params.height === "undefined") {
            throw new Error("Missing params.x/y/width/height");
        }
        var left = params.x;
        var top = params.y;
        var right = params.x + params.width;
        var bottom = params.y + params.height;
        var color = params.color && params.color.length === 3 ? params.color : [0, 0, 0];

        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(sID("contentLayer"));
        desc.putReference(cID("null"), ref);
        var desc2 = new ActionDescriptor();
        var shapeDesc = new ActionDescriptor();
        shapeDesc.putUnitDouble(cID("Top "), cID("#Pxl"), top);
        shapeDesc.putUnitDouble(cID("Left"), cID("#Pxl"), left);
        shapeDesc.putUnitDouble(cID("Btom"), cID("#Pxl"), bottom);
        shapeDesc.putUnitDouble(cID("Rght"), cID("#Pxl"), right);
        desc2.putObject(cID("Shp "), cID("Rctn"), shapeDesc);
        var fillDesc = new ActionDescriptor();
        var rgb = new ActionDescriptor();
        rgb.putDouble(cID("Rd  "), color[0]);
        rgb.putDouble(cID("Grn "), color[1]);
        rgb.putDouble(cID("Bl  "), color[2]);
        fillDesc.putObject(cID("Clr "), cID("RGBC"), rgb);
        desc2.putObject(cID("Type"), sID("solidColorLayer"), fillDesc);
        desc.putObject(cID("Usng"), sID("contentLayer"), desc2);
        executeAction(cID("Mk  "), desc, DialogModes.NO);
        if (params.name) {
            doc.activeLayer.name = params.name;
        }
        return { name: doc.activeLayer.name, id: doc.activeLayer.id, kind: "shape_rect" };
    }

    function addShapeLayerEllipse(doc, params) {
        if (!params || typeof params.x === "undefined" || typeof params.y === "undefined" ||
            typeof params.width === "undefined" || typeof params.height === "undefined") {
            throw new Error("Missing params.x/y/width/height");
        }
        var left = params.x;
        var top = params.y;
        var right = params.x + params.width;
        var bottom = params.y + params.height;
        var color = params.color && params.color.length === 3 ? params.color : [0, 0, 0];

        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(sID("contentLayer"));
        desc.putReference(cID("null"), ref);
        var desc2 = new ActionDescriptor();
        var shapeDesc = new ActionDescriptor();
        shapeDesc.putUnitDouble(cID("Top "), cID("#Pxl"), top);
        shapeDesc.putUnitDouble(cID("Left"), cID("#Pxl"), left);
        shapeDesc.putUnitDouble(cID("Btom"), cID("#Pxl"), bottom);
        shapeDesc.putUnitDouble(cID("Rght"), cID("#Pxl"), right);
        desc2.putObject(cID("Shp "), cID("Elps"), shapeDesc);
        var fillDesc = new ActionDescriptor();
        var rgb = new ActionDescriptor();
        rgb.putDouble(cID("Rd  "), color[0]);
        rgb.putDouble(cID("Grn "), color[1]);
        rgb.putDouble(cID("Bl  "), color[2]);
        fillDesc.putObject(cID("Clr "), cID("RGBC"), rgb);
        desc2.putObject(cID("Type"), sID("solidColorLayer"), fillDesc);
        desc.putObject(cID("Usng"), sID("contentLayer"), desc2);
        executeAction(cID("Mk  "), desc, DialogModes.NO);
        if (params.name) {
            doc.activeLayer.name = params.name;
        }
        return { name: doc.activeLayer.name, id: doc.activeLayer.id, kind: "shape_ellipse" };
    }

    function transformActiveLayer(doc, params) {
        if (!params) {
            throw new Error("Missing params");
        }
        var layer = doc.activeLayer;
        if (typeof params.scaleX !== "undefined" || typeof params.scaleY !== "undefined") {
            var scaleX = typeof params.scaleX !== "undefined" ? params.scaleX : 100;
            var scaleY = typeof params.scaleY !== "undefined" ? params.scaleY : 100;
            layer.resize(scaleX, scaleY, AnchorPosition.MIDDLECENTER);
        }
        if (typeof params.rotate !== "undefined") {
            layer.rotate(params.rotate, AnchorPosition.MIDDLECENTER);
        }
        if (typeof params.offsetX !== "undefined" || typeof params.offsetY !== "undefined") {
            var dx = typeof params.offsetX !== "undefined" ? params.offsetX : 0;
            var dy = typeof params.offsetY !== "undefined" ? params.offsetY : 0;
            layer.translate(dx, dy);
        }
        return { transformed: true, id: layer.id };
    }

    function flipActiveLayer(doc, direction) {
        var layer = doc.activeLayer;
        if (direction === "horizontal") {
            layer.resize(-100, 100, AnchorPosition.MIDDLECENTER);
        } else {
            layer.resize(100, -100, AnchorPosition.MIDDLECENTER);
        }
        return { flipped: direction, id: layer.id };
    }

    function alignLayers(doc, params) {
        if (!params || !params.layerIds || params.layerIds.length === 0) {
            throw new Error("Missing params.layerIds");
        }
        var mode = normalizeEnumKey(params.mode || "LEFT");
        var reference = normalizeEnumKey(params.reference || "FIRST");
        var layers = [];
        for (var i = 0; i < params.layerIds.length; i++) {
            var layer = findLayerById(doc, params.layerIds[i]);
            if (layer) {
                layers.push(layer);
            }
        }
        if (layers.length === 0) {
            throw new Error("No layers found to align");
        }
        var refBounds;
        if (reference === "DOCUMENT") {
            refBounds = [0, 0, doc.width.as("px"), doc.height.as("px")];
        } else {
            refBounds = getLayerBoundsPx(layers[0]);
        }
        for (var j = 0; j < layers.length; j++) {
            if (reference !== "DOCUMENT" && j === 0) {
                continue;
            }
            var b = getLayerBoundsPx(layers[j]);
            var dx = 0;
            var dy = 0;
            if (mode === "LEFT") {
                dx = refBounds[0] - b[0];
            } else if (mode === "RIGHT") {
                dx = refBounds[2] - b[2];
            } else if (mode === "CENTER_HORIZONTAL") {
                dx = (refBounds[0] + refBounds[2]) / 2 - (b[0] + b[2]) / 2;
            } else if (mode === "TOP") {
                dy = refBounds[1] - b[1];
            } else if (mode === "BOTTOM") {
                dy = refBounds[3] - b[3];
            } else if (mode === "CENTER_VERTICAL") {
                dy = (refBounds[1] + refBounds[3]) / 2 - (b[1] + b[3]) / 2;
            } else {
                throw new Error("Unsupported align mode: " + params.mode);
            }
            layers[j].translate(dx, dy);
        }
        return { aligned: layers.length, mode: params.mode || "LEFT" };
    }

    function distributeLayers(doc, params) {
        if (!params || !params.layerIds || params.layerIds.length < 3) {
            throw new Error("Need at least 3 layers to distribute");
        }
        var axis = normalizeEnumKey(params.axis || "HORIZONTAL");
        var layers = [];
        for (var i = 0; i < params.layerIds.length; i++) {
            var layer = findLayerById(doc, params.layerIds[i]);
            if (layer) {
                layers.push(layer);
            }
        }
        if (layers.length < 3) {
            throw new Error("No layers found to distribute");
        }
        var items = [];
        for (var j = 0; j < layers.length; j++) {
            var b = getLayerBoundsPx(layers[j]);
            var cx = (b[0] + b[2]) / 2;
            var cy = (b[1] + b[3]) / 2;
            items.push({ layer: layers[j], bounds: b, cx: cx, cy: cy });
        }
        items.sort(function (a, b) {
            return axis === "VERTICAL" ? a.cy - b.cy : a.cx - b.cx;
        });
        var min = axis === "VERTICAL" ? items[0].cy : items[0].cx;
        var max = axis === "VERTICAL" ? items[items.length - 1].cy : items[items.length - 1].cx;
        var step = (max - min) / (items.length - 1);
        for (var k = 0; k < items.length; k++) {
            var target = min + step * k;
            var dx = 0;
            var dy = 0;
            if (axis === "VERTICAL") {
                dy = target - items[k].cy;
            } else {
                dx = target - items[k].cx;
            }
            items[k].layer.translate(dx, dy);
        }
        return { distributed: items.length, axis: params.axis || "HORIZONTAL" };
    }

    function placeImageAsLayer(doc, params) {
        if (!params || !params.path) {
            throw new Error("Missing params.path");
        }
        var file = new File(params.path);
        if (!file.exists) {
            throw new Error("File not found: " + params.path);
        }
        var desc = new ActionDescriptor();
        desc.putPath(cID("null"), file);
        desc.putEnumerated(cID("FTcs"), cID("QCSt"), cID("Qcsa"));
        desc.putUnitDouble(cID("Wdth"), cID("#Prc"), 100);
        desc.putUnitDouble(cID("Hght"), cID("#Prc"), 100);
        executeAction(cID("Plc "), desc, DialogModes.NO);
        if (params.name) {
            doc.activeLayer.name = params.name;
        }
        return { placed: true, name: doc.activeLayer.name, id: doc.activeLayer.id };
    }

    function exportActiveDocument(doc, params) {
        if (!params || !params.path || !params.format) {
            throw new Error("Missing params.path or params.format");
        }
        var file = new File(params.path);
        var formatKey = normalizeEnumKey(params.format);
        if (formatKey === "PNG") {
            var pngOpts = new ExportOptionsSaveForWeb();
            pngOpts.format = SaveDocumentType.PNG;
            pngOpts.PNG8 = false;
            pngOpts.transparency = true;
            doc.exportDocument(file, ExportType.SAVEFORWEB, pngOpts);
            return { exported: true, path: file.fsName, format: "png" };
        }
        if (formatKey === "JPG" || formatKey === "JPEG") {
            var jpgOpts = new ExportOptionsSaveForWeb();
            jpgOpts.format = SaveDocumentType.JPEG;
            if (params && typeof params.quality !== "undefined") {
                jpgOpts.quality = params.quality;
            }
            doc.exportDocument(file, ExportType.SAVEFORWEB, jpgOpts);
            return { exported: true, path: file.fsName, format: "jpg" };
        }
        if (formatKey === "WEBP") {
            if (typeof WebPSaveOptions === "undefined") {
                throw new Error("WebP export not supported in this Photoshop version");
            }
            var webpOpts = new WebPSaveOptions();
            if (params && typeof params.quality !== "undefined") {
                webpOpts.quality = params.quality;
            }
            doc.saveAs(file, webpOpts, true, Extension.LOWERCASE);
            return { exported: true, path: file.fsName, format: "webp" };
        }
        throw new Error("Unsupported export format: " + params.format);
    }

    function exportPreview(doc, params) {
        var path = "/tmp/ps_preview.png";
        var format = "png";
        var quality = undefined;
        if (params) {
            if (params.path) {
                path = params.path;
            }
            if (params.format) {
                format = params.format;
            }
            if (typeof params.quality !== "undefined") {
                quality = params.quality;
            }
        }
        return exportActiveDocument(doc, { path: path, format: format, quality: quality });
    }

    function historyUndo() {
        executeAction(cID("undo"), undefined, DialogModes.NO);
        return { undo: true };
    }

    function historyRedo() {
        executeAction(cID("redo"), undefined, DialogModes.NO);
        return { redo: true };
    }

    function createDocument(params) {
        if (!params || typeof params.width === "undefined" || typeof params.height === "undefined") {
            throw new Error("Missing params.width or params.height");
        }
        var width = toUnitValue(params.width, "px");
        var height = toUnitValue(params.height, "px");
        var resolution = params.resolution || 72;
        var name = params.name || "Untitled";
        var mode = mapNewDocumentMode(params.mode);
        var fill = mapDocumentFill(params.fill);
        var doc = app.documents.add(width, height, resolution, name, mode, fill);
        return getDocumentInfo(doc);
    }

    function openDocument(params) {
        if (!params || !params.path) {
            throw new Error("Missing params.path");
        }
        var file = new File(params.path);
        if (!file.exists) {
            throw new Error("File not found: " + params.path);
        }
        var doc = app.open(file);
        return getDocumentInfo(doc);
    }

    function saveActiveDocument(doc) {
        doc.save();
        return { saved: true, name: doc.name };
    }

    function buildSaveOptions(format, params) {
        var key = normalizeEnumKey(format);
        if (!key || key === "PSD" || key === "PHOTOSHOP") {
            return new PhotoshopSaveOptions();
        }
        if (key === "PNG") {
            return new PNGSaveOptions();
        }
        if (key === "JPG" || key === "JPEG") {
            var jpg = new JPEGSaveOptions();
            if (params && typeof params.quality !== "undefined") {
                jpg.quality = params.quality;
            }
            return jpg;
        }
        throw new Error("Unsupported save format: " + format);
    }

    function saveActiveDocumentAs(doc, params) {
        if (!params || !params.path) {
            throw new Error("Missing params.path");
        }
        var file = new File(params.path);
        var options = buildSaveOptions(params.format, params);
        var asCopy = params.asCopy ? true : false;
        doc.saveAs(file, options, asCopy, Extension.LOWERCASE);
        return { saved: true, name: doc.name, path: file.fsName };
    }

    function closeActiveDocument(doc, params) {
        var saveOptions = params && params.save ? mapSaveOptions(params.save) : SaveOptions.PROMPTTOSAVECHANGES;
        doc.close(saveOptions);
        return { closed: true };
    }

    function duplicateActiveDocument(doc, params) {
        var dup = doc.duplicate(params && params.name ? params.name : undefined);
        return { name: dup.name, id: dup.id };
    }

    function flattenActiveDocument(doc) {
        doc.flatten();
        return { flattened: true };
    }

    function resizeImage(doc, params) {
        if (!params || (typeof params.width === "undefined" && typeof params.height === "undefined" && typeof params.resolution === "undefined")) {
            throw new Error("Missing resize params");
        }
        var width = toUnitValue(params.width, "px");
        var height = toUnitValue(params.height, "px");
        var resolution = params.resolution;
        var method = mapResampleMethod(params.resample);
        doc.resizeImage(width, height, resolution, method);
        return getDocumentInfo(doc);
    }

    function resizeCanvas(doc, params) {
        if (!params || typeof params.width === "undefined" || typeof params.height === "undefined") {
            throw new Error("Missing params.width or params.height");
        }
        var width = toUnitValue(params.width, "px");
        var height = toUnitValue(params.height, "px");
        var anchor = mapAnchorPosition(params.anchor);
        doc.resizeCanvas(width, height, anchor);
        return getDocumentInfo(doc);
    }

    function rotateCanvas(doc, params) {
        if (!params || typeof params.angle === "undefined") {
            throw new Error("Missing params.angle");
        }
        doc.rotateCanvas(params.angle);
        return getDocumentInfo(doc);
    }

    function addTextLayer(doc, params) {
        if (!params || !params.text) {
            throw new Error("Missing params.text");
        }

        var layer = doc.artLayers.add();
        layer.kind = LayerKind.TEXT;
        layer.name = params.name || "Text Layer";

        var textItem = layer.textItem;
        textItem.contents = normalizeTextContent(params.text);

        if (params.font) {
            textItem.font = params.font;
        }
        if (params.size) {
            textItem.size = params.size;
        }
        if (params.position && params.position.length === 2) {
            textItem.position = [params.position[0], params.position[1]];
        }
        if (params.color && params.color.length === 3) {
            var textColor = new SolidColor();
            textColor.rgb.red = params.color[0];
            textColor.rgb.green = params.color[1];
            textColor.rgb.blue = params.color[2];
            textItem.color = textColor;
        }

        return {
            name: layer.name,
            id: layer.id
        };
    }

    function addParagraphTextLayer(doc, params) {
        if (!params || !params.text) {
            throw new Error("Missing params.text");
        }
        if (typeof params.boxWidth === "undefined" || typeof params.boxHeight === "undefined") {
            throw new Error("Missing params.boxWidth or params.boxHeight");
        }

        var layer = doc.artLayers.add();
        layer.kind = LayerKind.TEXT;
        layer.name = params.name || "Paragraph Text";

        var textItem = layer.textItem;
        textItem.kind = TextType.PARAGRAPHTEXT;
        textItem.contents = normalizeTextContent(params.text);

        if (params.font) {
            textItem.font = params.font;
        }
        if (params.size) {
            textItem.size = params.size;
        }
        if (params.leading || params.leading === 0) {
            textItem.autoLeading = false;
            textItem.leading = params.leading;
        }
        if (params.tracking || params.tracking === 0) {
            textItem.tracking = params.tracking;
        }
        if (params.justification) {
            var justification = mapJustification(params.justification);
            if (justification) {
                textItem.justification = justification;
            }
        }
        if (params.position && params.position.length === 2) {
            textItem.position = [params.position[0], params.position[1]];
        }
        textItem.width = toUnitValue(params.boxWidth, "px");
        textItem.height = toUnitValue(params.boxHeight, "px");

        if (params.color && params.color.length === 3) {
            var textColor = new SolidColor();
            textColor.rgb.red = params.color[0];
            textColor.rgb.green = params.color[1];
            textColor.rgb.blue = params.color[2];
            textItem.color = textColor;
        }

        return {
            name: layer.name,
            id: layer.id
        };
    }

    function updateTextLayer(doc, params) {
        if (!params || (!params.layerId && !params.layerName)) {
            throw new Error("Missing params.layerId or params.layerName");
        }
        var layer = resolveLayerFromParams(doc, params);
        if (!layer) {
            throw new Error("Layer not found");
        }
        if (String(layer.kind) !== String(LayerKind.TEXT)) {
            throw new Error("Layer is not a text layer");
        }

        doc.activeLayer = layer;
        var textItem = layer.textItem;

        if (typeof params.text !== "undefined") {
            textItem.contents = normalizeTextContent(params.text);
        }
        if (typeof params.font !== "undefined") {
            textItem.font = params.font;
        }
        if (typeof params.size !== "undefined") {
            textItem.size = params.size;
        }
        if (typeof params.position !== "undefined" && params.position && params.position.length === 2) {
            textItem.position = [params.position[0], params.position[1]];
        }
        if (typeof params.color !== "undefined" && params.color && params.color.length === 3) {
            var c = new SolidColor();
            c.rgb.red = params.color[0];
            c.rgb.green = params.color[1];
            c.rgb.blue = params.color[2];
            textItem.color = c;
        }
        if (typeof params.tracking !== "undefined") {
            textItem.tracking = params.tracking;
        }
        if (typeof params.justification !== "undefined") {
            var just = mapJustification(params.justification);
            if (just) {
                textItem.justification = just;
            }
        }

        // Paragraph-only sizing/metrics.
        if (typeof params.boxWidth !== "undefined") {
            textItem.kind = TextType.PARAGRAPHTEXT;
            textItem.width = toUnitValue(params.boxWidth, "px");
        }
        if (typeof params.boxHeight !== "undefined") {
            textItem.kind = TextType.PARAGRAPHTEXT;
            textItem.height = toUnitValue(params.boxHeight, "px");
        }
        if (typeof params.leading !== "undefined") {
            textItem.autoLeading = false;
            textItem.leading = params.leading;
        }
        if (typeof params.autoLeading !== "undefined") {
            textItem.autoLeading = params.autoLeading ? true : false;
        }

        return { id: layer.id, name: layer.name, kind: "text" };
    }

    function getTextLayerState(layer) {
        var t = layer.textItem;
        var state = {
            kind: String(t.kind),
            font: t.font,
            size: Number(t.size),
            autoLeading: t.autoLeading ? true : false,
            leading: null,
            tracking: Number(t.tracking)
        };
        try {
            state.leading = Number(t.leading);
        } catch (e) {
            state.leading = null;
        }
        return state;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function isCjkText(text) {
        return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
    }

    function splitLines(text) {
        return normalizeTextContent(text).split("\r");
    }

    function wrapLatinLine(line, maxChars) {
        var parts = line.split(" ");
        var lines = [];
        var current = "";
        for (var i = 0; i < parts.length; i++) {
            var word = parts[i];
            if (current === "") {
                if (word.length > maxChars) {
                    var start = 0;
                    while (start < word.length) {
                        lines.push(word.substr(start, maxChars));
                        start += maxChars;
                    }
                } else {
                    current = word;
                }
            } else if (current.length + 1 + word.length <= maxChars) {
                current += " " + word;
            } else {
                lines.push(current);
                current = "";
                if (word.length > maxChars) {
                    var j = 0;
                    while (j < word.length) {
                        lines.push(word.substr(j, maxChars));
                        j += maxChars;
                    }
                } else {
                    current = word;
                }
            }
        }
        if (current !== "") {
            lines.push(current);
        }
        return lines;
    }

    function wrapCjkLine(line, maxChars) {
        var lines = [];
        var start = 0;
        while (start < line.length) {
            lines.push(line.substr(start, maxChars));
            start += maxChars;
        }
        return lines;
    }

    function autoLineBreakText(text, size, boxWidth, tracking, enabled) {
        if (!enabled) {
            return normalizeTextContent(text);
        }
        var safeSize = Math.max(1, size);
        var trackingAdjust = (tracking || 0) * safeSize / 1000;
        var cjk = isCjkText(text);
        var baseChar = safeSize * (cjk ? 1.0 : 0.55);
        var charWidth = Math.max(safeSize * 0.4, baseChar + trackingAdjust);
        var maxChars = Math.max(1, Math.floor(boxWidth / charWidth));
        var inputLines = splitLines(text);
        var outLines = [];
        for (var i = 0; i < inputLines.length; i++) {
            var line = inputLines[i];
            if (line === "") {
                outLines.push("");
                continue;
            }
            var wrapped = cjk ? wrapCjkLine(line, maxChars) : wrapLatinLine(line, maxChars);
            for (var j = 0; j < wrapped.length; j++) {
                outLines.push(wrapped[j]);
            }
        }
        return outLines.join("\r");
    }

    function resolveStyleTracking(params) {
        var preset = params && params.stylePreset ? String(params.stylePreset).toLowerCase() : null;
        var tracking = typeof params.tracking !== "undefined" ? params.tracking : null;
        if (preset === "title") {
            if (tracking === null || tracking === undefined) {
                tracking = -5;
            }
            tracking = clamp(tracking, -10, 0);
        } else if (preset === "body") {
            if (tracking === null || tracking === undefined) {
                tracking = 10;
            }
            tracking = clamp(tracking, 0, 20);
        } else {
            if (tracking === null || tracking === undefined) {
                tracking = 0;
            }
        }
        return tracking;
    }

    function resolveLeadingMultiplier(params) {
        var preset = params && params.stylePreset ? String(params.stylePreset).toLowerCase() : null;
        if (preset === "title") {
            return 1.1;
        }
        if (preset === "body") {
            return 1.4;
        }
        return 1.2;
    }

    function applyTextColor(textItem, color) {
        if (!color || color.length !== 3) {
            return;
        }
        var textColor = new SolidColor();
        textColor.rgb.red = color[0];
        textColor.rgb.green = color[1];
        textColor.rgb.blue = color[2];
        textItem.color = textColor;
    }

    function applyParagraphTextBox(textItem, left, top, width, height) {
        textItem.kind = TextType.PARAGRAPHTEXT;
        textItem.position = [left, top];
        textItem.width = toUnitValue(width, "px");
        textItem.height = toUnitValue(height, "px");
    }

    function applyTextAlignment(textItem, params) {
        var alignValue = params && typeof params.align !== "undefined" ? params.align : params.justification;
        if (typeof alignValue === "undefined") {
            return;
        }
        var justification = mapJustification(alignValue);
        if (justification) {
            textItem.justification = justification;
        }
    }

    function measureTextBounds(doc, params) {
        if (!params || typeof params.text === "undefined") {
            throw new Error("Missing params.text");
        }
        var prevLayer = doc.activeLayer;
        var layer = doc.artLayers.add();
        layer.kind = LayerKind.TEXT;
        layer.name = "Measure Text Bounds";
        var textItem = layer.textItem;
        textItem.kind = TextType.POINTTEXT;
        textItem.contents = normalizeTextContent(params.text);
        if (params.font) {
            textItem.font = params.font;
        }
        if (params.size) {
            textItem.size = params.size;
        }
        if (params.position && params.position.length === 2) {
            textItem.position = [params.position[0], params.position[1]];
        } else {
            textItem.position = [0, 0];
        }
        if (typeof params.tracking !== "undefined") {
            textItem.tracking = params.tracking;
        }
        if (typeof params.leading !== "undefined") {
            textItem.autoLeading = false;
            textItem.leading = params.leading;
        }
        var bounds = getLayerBoundsPx(layer);
        var width = bounds[2] - bounds[0];
        var height = bounds[3] - bounds[1];
        layer.remove();
        if (prevLayer) {
            doc.activeLayer = prevLayer;
        }
        return { width: width, height: height, bounds: bounds };
    }

    function fitTextLayerToBox(doc, layer, params, box, textSource) {
        var padding = typeof params.padding !== "undefined" ? params.padding : 0;
        var left = box.x + padding;
        var top = box.y + padding;
        var right = box.x + box.width - padding;
        var bottom = box.y + box.height - padding;
        if (right <= left || bottom <= top) {
            throw new Error("Invalid box after padding");
        }

        var t = layer.textItem;
        applyParagraphTextBox(t, left, top, right - left, bottom - top);
        applyTextAlignment(t, params);
        if (params.font) {
            t.font = params.font;
        }
        if (params.color) {
            applyTextColor(t, params.color);
        }

        var tracking = resolveStyleTracking(params);
        var leadingMultiplier = resolveLeadingMultiplier(params);
        var hasLeading = (typeof params.leading !== "undefined");
        var autoLeadingOverride = (typeof params.autoLeading !== "undefined") ? (params.autoLeading ? true : false) : null;
        var useAutoLeading = autoLeadingOverride === true;
        var fixedLeading = hasLeading ? params.leading : null;
        var autoLineBreak = params.autoLineBreak ? true : false;

        var minSize = typeof params.minSize !== "undefined" ? params.minSize : 4;
        var maxSize = typeof params.maxSize !== "undefined" ? params.maxSize : Math.max(minSize, Math.min(right - left, bottom - top));
        var currentSize = Number(t.size) || 12;
        if (!params.allowUpscale) {
            maxSize = Math.min(maxSize, currentSize);
        }

        var size = typeof params.size !== "undefined" ? params.size : maxSize;
        size = clamp(size, minSize, maxSize);

        var sourceText = typeof textSource !== "undefined" && textSource !== null ? textSource : t.contents;
        sourceText = normalizeTextContent(sourceText);

        var maxIterations = typeof params.maxIterations !== "undefined" ? params.maxIterations : 18;
        var lastSize = null;
        var bounds = null;
        var i;
        for (i = 0; i < maxIterations; i++) {
            if (size < minSize) {
                size = minSize;
            }
            t.size = size;
            if (typeof tracking !== "undefined" && tracking !== null) {
                t.tracking = tracking;
            }
            if (useAutoLeading) {
                try {
                    t.autoLeading = true;
                } catch (e) {
                }
            } else if (hasLeading) {
                try {
                    t.autoLeading = false;
                    t.leading = fixedLeading;
                } catch (e2) {
                }
            } else {
                try {
                    t.autoLeading = false;
                    t.leading = Math.round(size * leadingMultiplier * 100) / 100;
                } catch (e3) {
                }
            }

            if (autoLineBreak) {
                t.contents = autoLineBreakText(sourceText, size, right - left, tracking, true);
            } else if (typeof params.text !== "undefined") {
                t.contents = sourceText;
            }

            bounds = getLayerBoundsPx(layer);
            var fits = bounds[0] >= left && bounds[1] >= top && bounds[2] <= right && bounds[3] <= bottom;
            if (fits) {
                break;
            }

            var width = Math.max(1, bounds[2] - bounds[0]);
            var height = Math.max(1, bounds[3] - bounds[1]);
            var scaleW = (right - left) / width;
            var scaleH = (bottom - top) / height;
            var scale = Math.min(scaleW, scaleH, 0.98);
            if (scale >= 1) {
                size -= 0.5;
            } else {
                var newSize = size * scale;
                if (Math.abs(newSize - size) < 0.25) {
                    newSize = size - 0.5;
                }
                size = newSize;
            }
            if (lastSize !== null && Math.abs(size - lastSize) < 0.1) {
                size -= 0.5;
            }
            lastSize = size;
            if (size <= minSize) {
                size = minSize;
            }
        }

        if (useAutoLeading) {
            try {
                t.autoLeading = true;
            } catch (e4) {
            }
        } else if (!hasLeading) {
            try {
                t.autoLeading = false;
                t.leading = Math.round(size * leadingMultiplier * 100) / 100;
            } catch (e5) {
            }
        }
        bounds = getLayerBoundsPx(layer);

        if (params.opticalCenter) {
            var opticalShift = (box.height || (bottom - top)) * 0.03;
            var maxShift = bounds[1] - top;
            var applied = Math.min(opticalShift, maxShift);
            if (applied > 0) {
                t.position = [t.position[0], t.position[1] - applied];
                bounds = getLayerBoundsPx(layer);
            }
        }

        var leadingValue = null;
        try {
            leadingValue = Number(t.leading);
        } catch (e6) {
            leadingValue = null;
        }
        return {
            iterations: i,
            bounds: bounds,
            size: Number(t.size),
            tracking: Number(t.tracking),
            leading: leadingValue,
            box: [left, top, right, bottom]
        };
    }

    function addTextLayerAuto(doc, params) {
        if (!params || typeof params.text === "undefined") {
            throw new Error("Missing params.text");
        }
        if (!params.box || typeof params.box.x === "undefined" || typeof params.box.y === "undefined" ||
            typeof params.box.width === "undefined" || typeof params.box.height === "undefined") {
            throw new Error("Missing params.box (x/y/width/height)");
        }

        var layer = doc.artLayers.add();
        layer.kind = LayerKind.TEXT;
        layer.name = params.name || "Auto Text";
        var t = layer.textItem;
        t.contents = normalizeTextContent(params.text);

        var fitParams = {};
        for (var k in params) {
            if (params.hasOwnProperty(k)) {
                fitParams[k] = params[k];
            }
        }
        if (typeof fitParams.autoLineBreak === "undefined") {
            fitParams.autoLineBreak = true;
        }
        if (typeof fitParams.allowUpscale === "undefined") {
            fitParams.allowUpscale = true;
        }

        var fit = fitTextLayerToBox(doc, layer, fitParams, fitParams.box, fitParams.text);

        return {
            id: layer.id,
            name: layer.name,
            bounds: fit.bounds,
            size: fit.size,
            tracking: fit.tracking,
            leading: fit.leading,
            iterations: fit.iterations
        };
    }

    function fitTextToBox(doc, params) {
        if (!params || (!params.layerId && !params.layerName)) {
            throw new Error("Missing params.layerId or params.layerName");
        }
        if (!params.box || typeof params.box.x === "undefined" || typeof params.box.y === "undefined" ||
            typeof params.box.width === "undefined" || typeof params.box.height === "undefined") {
            throw new Error("Missing params.box (x/y/width/height)");
        }

        var layer = resolveLayerFromParams(doc, params);
        if (!layer) {
            throw new Error("Layer not found");
        }
        if (String(layer.kind) !== String(LayerKind.TEXT)) {
            throw new Error("Layer is not a text layer");
        }

        doc.activeLayer = layer;
        var fit = fitTextLayerToBox(doc, layer, params, params.box, typeof params.text !== "undefined" ? params.text : null);

        return {
            id: layer.id,
            name: layer.name,
            iterations: fit.iterations,
            bounds: fit.bounds,
            box: fit.box,
            size: fit.size,
            tracking: fit.tracking,
            leading: fit.leading,
            text: getTextLayerState(layer)
        };
    }

    function addEmptyLayer(doc, params) {
        var layer = doc.artLayers.add();
        if (params && params.name) {
            layer.name = params.name;
        }
        return { name: layer.name, id: layer.id };
    }

    function mergeActiveDown(doc) {
        var merged = doc.activeLayer.merge();
        return {
            name: merged.name,
            id: merged.id
        };
    }

    function mergeVisible(doc) {
        doc.mergeVisibleLayers();
        return { merged: true };
    }

    function duplicateActiveLayer(doc, params) {
        var layer = doc.activeLayer;
        var dup = layer.duplicate();
        if (params && params.name) {
            dup.name = params.name;
        }
        return { name: dup.name, id: dup.id };
    }

    function deleteActiveLayer(doc) {
        var layer = doc.activeLayer;
        var info = { name: layer.name, id: layer.id };
        layer.remove();
        info.deleted = true;
        return info;
    }

    function renameActiveLayer(doc, params) {
        if (!params || !params.name) {
            throw new Error("Missing params.name");
        }
        doc.activeLayer.name = params.name;
        return { name: doc.activeLayer.name, id: doc.activeLayer.id };
    }

    function setActiveLayerVisibility(doc, params) {
        if (!params || typeof params.visible === "undefined") {
            throw new Error("Missing params.visible");
        }
        doc.activeLayer.visible = params.visible ? true : false;
        return { visible: doc.activeLayer.visible, id: doc.activeLayer.id };
    }

    function setActiveLayerOpacity(doc, params) {
        if (!params || typeof params.opacity === "undefined") {
            throw new Error("Missing params.opacity");
        }
        doc.activeLayer.opacity = params.opacity;
        return { opacity: doc.activeLayer.opacity, id: doc.activeLayer.id };
    }

    function setActiveLayerBlendMode(doc, params) {
        if (!params || !params.mode) {
            throw new Error("Missing params.mode");
        }
        doc.activeLayer.blendMode = mapBlendMode(params.mode);
        return { blendMode: doc.activeLayer.blendMode.toString(), id: doc.activeLayer.id };
    }

    function executeCommand(command, params) {
        var noDocCommands = {
            ping: true,
            list_fonts: true,
            create_document: true,
            open_document: true,
            set_foreground_color: true,
            batch_commands: true
        };

        if (!noDocCommands[command] && app.documents.length == 0) {
            throw new Error("No document open");
        }

        if (command === "ping") {
            return { status: "ok", message: "pong" };
        }
        if (command === "create_document") {
            return createDocument(params);
        }
        if (command === "open_document") {
            return openDocument(params);
        }
        if (command === "get_document_info") {
            return getDocumentInfo(app.activeDocument);
        }
        if (command === "list_layers") {
            return listLayers(app.activeDocument);
        }
        if (command === "list_fonts") {
            return listFonts();
        }
        if (command === "save_active_document") {
            return saveActiveDocument(app.activeDocument);
        }
        if (command === "save_active_document_as") {
            return saveActiveDocumentAs(app.activeDocument, params);
        }
        if (command === "close_active_document") {
            return closeActiveDocument(app.activeDocument, params);
        }
        if (command === "duplicate_active_document") {
            return duplicateActiveDocument(app.activeDocument, params);
        }
        if (command === "flatten_active_document") {
            return flattenActiveDocument(app.activeDocument);
        }
        if (command === "resize_image") {
            return resizeImage(app.activeDocument, params);
        }
        if (command === "resize_canvas") {
            return resizeCanvas(app.activeDocument, params);
        }
        if (command === "rotate_canvas") {
            return rotateCanvas(app.activeDocument, params);
        }
        if (command === "add_text_layer") {
            return addTextLayer(app.activeDocument, params);
        }
        if (command === "add_text_layer_auto") {
            return addTextLayerAuto(app.activeDocument, params);
        }
        if (command === "add_paragraph_text_layer") {
            return addParagraphTextLayer(app.activeDocument, params);
        }
        if (command === "update_text_layer") {
            return updateTextLayer(app.activeDocument, params);
        }
        if (command === "measure_text_bounds") {
            return measureTextBounds(app.activeDocument, params);
        }
        if (command === "fit_text_to_box") {
            return fitTextToBox(app.activeDocument, params);
        }
        if (command === "add_empty_layer") {
            return addEmptyLayer(app.activeDocument, params);
        }
        if (command === "merge_active_down") {
            return mergeActiveDown(app.activeDocument);
        }
        if (command === "merge_visible_layers") {
            return mergeVisible(app.activeDocument);
        }
        if (command === "duplicate_active_layer") {
            return duplicateActiveLayer(app.activeDocument, params);
        }
        if (command === "delete_active_layer") {
            return deleteActiveLayer(app.activeDocument);
        }
        if (command === "rename_active_layer") {
            return renameActiveLayer(app.activeDocument, params);
        }
        if (command === "set_active_layer_visibility") {
            return setActiveLayerVisibility(app.activeDocument, params);
        }
        if (command === "set_active_layer_opacity") {
            return setActiveLayerOpacity(app.activeDocument, params);
        }
        if (command === "set_active_layer_blend_mode") {
            return setActiveLayerBlendMode(app.activeDocument, params);
        }
        if (command === "select_all") {
            return createSelectionAll(app.activeDocument);
        }
        if (command === "deselect") {
            return deselectSelection(app.activeDocument);
        }
        if (command === "invert_selection") {
            return invertSelection(app.activeDocument);
        }
        if (command === "expand_selection") {
            return expandSelection(app.activeDocument, params);
        }
        if (command === "contract_selection") {
            return contractSelection(app.activeDocument, params);
        }
        if (command === "feather_selection") {
            return featherSelection(app.activeDocument, params);
        }
        if (command === "set_foreground_color") {
            return setForegroundColor(params);
        }
        if (command === "add_bezier_path") {
            return addBezierPath(app.activeDocument, params);
        }
        if (command === "stroke_path") {
            return strokePathItem(app.activeDocument, params);
        }
        if (command === "delete_path") {
            return deletePathItem(app.activeDocument, params);
        }
        if (command === "apply_layer_style") {
            return applyLayerStyleByName(app.activeDocument, params);
        }
        if (command === "set_layer_style") {
            return setLayerStyle(app.activeDocument, params);
        }
        if (command === "set_active_layer") {
            return setActiveLayer(app.activeDocument, params);
        }
        if (command === "get_layer_bounds") {
            return getLayerBounds(app.activeDocument, params);
        }
        if (command === "check_layer_overlap") {
            return checkLayerOverlap(app.activeDocument, params);
        }
        if (command === "create_layer_group") {
            return createLayerGroup(app.activeDocument, params);
        }
        if (command === "move_layers_to_group") {
            return moveLayersIntoGroup(app.activeDocument, params);
        }
        if (command === "ungroup_layer_group") {
            return ungroupLayerGroup(app.activeDocument, params);
        }
        if (command === "add_levels_adjustment_layer") {
            return addLevelsAdjustmentLayer(app.activeDocument, params);
        }
        if (command === "add_curves_adjustment_layer") {
            return addCurvesAdjustmentLayer(app.activeDocument, params);
        }
        if (command === "add_hue_saturation_adjustment_layer") {
            return addHueSaturationAdjustmentLayer(app.activeDocument, params);
        }
        if (command === "add_black_white_adjustment_layer") {
            return addBlackWhiteAdjustmentLayer(app.activeDocument, params);
        }
        if (command === "add_solid_fill_layer") {
            return addSolidFillLayer(app.activeDocument, params);
        }
        if (command === "add_gradient_fill_layer") {
            return addGradientFillLayer(app.activeDocument, params);
        }
        if (command === "add_pattern_fill_layer") {
            return addPatternFillLayer(app.activeDocument, params);
        }
        if (command === "create_layer_mask") {
            return createLayerMask(app.activeDocument, params);
        }
        if (command === "apply_layer_mask") {
            return applyLayerMask(app.activeDocument);
        }
        if (command === "delete_layer_mask") {
            return deleteLayerMask(app.activeDocument, params);
        }
        if (command === "invert_layer_mask") {
            return invertLayerMask(app.activeDocument);
        }
        if (command === "set_clipping_mask") {
            return setClippingMask(app.activeDocument, params);
        }
        if (command === "create_clipping_mask") {
            return setClippingMask(app.activeDocument, { enabled: true });
        }
        if (command === "release_clipping_mask") {
            return setClippingMask(app.activeDocument, { enabled: false });
        }
        if (command === "add_shape_rect") {
            return addShapeLayerRect(app.activeDocument, params);
        }
        if (command === "add_shape_ellipse") {
            return addShapeLayerEllipse(app.activeDocument, params);
        }
        if (command === "transform_active_layer") {
            return transformActiveLayer(app.activeDocument, params);
        }
        if (command === "flip_active_layer_horizontal") {
            return flipActiveLayer(app.activeDocument, "horizontal");
        }
        if (command === "flip_active_layer_vertical") {
            return flipActiveLayer(app.activeDocument, "vertical");
        }
        if (command === "align_layers") {
            return alignLayers(app.activeDocument, params);
        }
        if (command === "distribute_layers") {
            return distributeLayers(app.activeDocument, params);
        }
        if (command === "place_image_as_layer") {
            return placeImageAsLayer(app.activeDocument, params);
        }
        if (command === "export_document") {
            return exportActiveDocument(app.activeDocument, params);
        }
        if (command === "export_preview") {
            return exportPreview(app.activeDocument, params);
        }
        if (command === "history_undo") {
            return historyUndo();
        }
        if (command === "history_redo") {
            return historyRedo();
        }
        if (command === "create_layers_bulk") {
            return createLayersBulk(app.activeDocument, params);
        }
        if (command === "apply_layer_styles_bulk") {
            return applyLayerStylesBulk(app.activeDocument, params);
        }
        if (command === "set_text_bulk") {
            return setTextBulk(app.activeDocument, params);
        }

        throw new Error("Unknown command: " + command);
    }

    function batchCommands(params) {
        if (!params || !isArray(params.commands)) {
            throw new Error("Missing params.commands");
        }
        var continueOnError = params.continueOnError ? true : false;
        var results = [];
        var okCount = 0;
        var errorCount = 0;
        for (var i = 0; i < params.commands.length; i++) {
            var item = params.commands[i] || {};
            var cmd = item.command || null;
            var res = { command: cmd, ok: false };
            if (!cmd) {
                res.error = "Missing command";
                results.push(res);
                errorCount++;
                if (!continueOnError) {
                    break;
                }
                continue;
            }
            try {
                res.result = executeCommand(cmd, item.params || {});
                res.ok = true;
                okCount++;
            } catch (err) {
                res.error = err.toString();
                errorCount++;
            }
            results.push(res);
            if (!res.ok && !continueOnError) {
                break;
            }
        }
        return { okCount: okCount, errorCount: errorCount, results: results };
    }

    function createLayersBulk(doc, params) {
        if (!params || !isArray(params.layers)) {
            throw new Error("Missing params.layers");
        }
        var results = [];
        var okCount = 0;
        var errorCount = 0;
        for (var i = 0; i < params.layers.length; i++) {
            var item = params.layers[i] || {};
            var kind = item.kind ? String(item.kind).toLowerCase() : "empty";
            var res = { index: i, ok: false, kind: kind };
            try {
                if (kind === "text") {
                    res.result = addTextLayer(doc, item);
                } else if (kind === "empty" || kind === "") {
                    res.result = addEmptyLayer(doc, item);
                } else {
                    throw new Error("Unsupported layer kind: " + item.kind);
                }
                res.ok = true;
                okCount++;
            } catch (err) {
                res.error = err.toString();
                errorCount++;
            }
            results.push(res);
        }
        return { okCount: okCount, errorCount: errorCount, results: results };
    }

    function applyLayerStylesBulk(doc, params) {
        if (!params || !isArray(params.styles)) {
            throw new Error("Missing params.styles");
        }
        var results = [];
        var okCount = 0;
        var errorCount = 0;
        for (var i = 0; i < params.styles.length; i++) {
            var item = params.styles[i] || {};
            var res = { index: i, ok: false };
            try {
                if (!item.style) {
                    throw new Error("Missing style");
                }
                var payload = {};
                if (typeof item.layerId !== "undefined") {
                    payload.layerId = item.layerId;
                }
                if (item.layerName) {
                    payload.layerName = item.layerName;
                }
                for (var key in item.style) {
                    if (item.style.hasOwnProperty(key)) {
                        payload[key] = item.style[key];
                    }
                }
                res.result = setLayerStyle(doc, payload);
                res.ok = true;
                okCount++;
            } catch (err) {
                res.error = err.toString();
                errorCount++;
            }
            results.push(res);
        }
        return { okCount: okCount, errorCount: errorCount, results: results };
    }

    function setTextBulk(doc, params) {
        if (!params || !isArray(params.items)) {
            throw new Error("Missing params.items");
        }
        var results = [];
        var okCount = 0;
        var errorCount = 0;
        for (var i = 0; i < params.items.length; i++) {
            var item = params.items[i] || {};
            var res = { index: i, ok: false };
            try {
                res.result = updateTextLayer(doc, item);
                res.ok = true;
                okCount++;
            } catch (err) {
                res.error = err.toString();
                errorCount++;
            }
            results.push(res);
        }
        return { okCount: okCount, errorCount: errorCount, results: results };
    }

    var response = { ok: false, data: null, error: null };

    try {
        var raw = readFile(requestPath);
        var request = parseRequest(raw);
        var command = request.command;

        if (!command) {
            throw new Error("Missing command");
        }

        if (command === "batch_commands") {
            response.data = batchCommands(request.params);
        } else {
            response.data = executeCommand(command, request.params);
        }

        response.ok = true;
    } catch (err) {
        response.ok = false;
        response.error = err.toString();
    }

    try {
        writeFile(responsePath, stringify(response));
    } catch (writeErr) {
        alert("Failed to write response: " + writeErr);
    }
})(__psAgentArgs);
