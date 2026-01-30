#target photoshop

(function () {
    var scriptFile = new File($.fileName);
    var baseDir = scriptFile.parent;
    var requestPath = baseDir.fsName + "/ps_request.json";
    var responsePath = baseDir.fsName + "/ps_response.json";

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
        var c = new SolidColor();
        c.rgb.red = params.color[0];
        c.rgb.green = params.color[1];
        c.rgb.blue = params.color[2];
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

    function buildGradientDescriptor(params) {
        var colorStops = [];
        if (params && params.colors && params.colors.length >= 2) {
            colorStops = params.colors;
        } else {
            colorStops = [[0, 0, 0], [255, 255, 255]];
        }

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
            var c = new ActionDescriptor();
            c.putDouble(cID("Rd  "), colorStops[i][0]);
            c.putDouble(cID("Grn "), colorStops[i][1]);
            c.putDouble(cID("Bl  "), colorStops[i][2]);
            stop.putObject(cID("Clr "), cID("RGBC"), c);
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

        var gradientLayer = new ActionDescriptor();
        gradientLayer.putEnumerated(cID("Type"), cID("GrdT"), typeId);
        gradientLayer.putBoolean(cID("Dthr"), true);
        gradientLayer.putBoolean(cID("Rvrs"), false);
        gradientLayer.putUnitDouble(cID("Angl"), cID("#Ang"), angle);
        gradientLayer.putUnitDouble(cID("Scl "), cID("#Prc"), scale);
        gradientLayer.putObject(cID("Grad"), cID("Grdn"), gradientDesc);
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

    var response = { ok: false, data: null, error: null };

    try {
        var raw = readFile(requestPath);
        var request = parseRequest(raw);
        var command = request.command;

        if (!command) {
            throw new Error("Missing command");
        }

        var noDocCommands = {
            ping: true,
            list_fonts: true,
            create_document: true,
            open_document: true,
            set_foreground_color: true
        };

        if (!noDocCommands[command] && app.documents.length == 0) {
            throw new Error("No document open");
        }

        if (command === "ping") {
            response.data = { status: "ok", message: "pong" };
        } else if (command === "create_document") {
            response.data = createDocument(request.params);
        } else if (command === "open_document") {
            response.data = openDocument(request.params);
        } else if (command === "get_document_info") {
            response.data = getDocumentInfo(app.activeDocument);
        } else if (command === "list_layers") {
            response.data = listLayers(app.activeDocument);
        } else if (command === "list_fonts") {
            response.data = listFonts();
        } else if (command === "save_active_document") {
            response.data = saveActiveDocument(app.activeDocument);
        } else if (command === "save_active_document_as") {
            response.data = saveActiveDocumentAs(app.activeDocument, request.params);
        } else if (command === "close_active_document") {
            response.data = closeActiveDocument(app.activeDocument, request.params);
        } else if (command === "duplicate_active_document") {
            response.data = duplicateActiveDocument(app.activeDocument, request.params);
        } else if (command === "flatten_active_document") {
            response.data = flattenActiveDocument(app.activeDocument);
        } else if (command === "resize_image") {
            response.data = resizeImage(app.activeDocument, request.params);
        } else if (command === "resize_canvas") {
            response.data = resizeCanvas(app.activeDocument, request.params);
        } else if (command === "rotate_canvas") {
            response.data = rotateCanvas(app.activeDocument, request.params);
        } else if (command === "add_text_layer") {
            response.data = addTextLayer(app.activeDocument, request.params);
        } else if (command === "add_paragraph_text_layer") {
            response.data = addParagraphTextLayer(app.activeDocument, request.params);
        } else if (command === "add_empty_layer") {
            response.data = addEmptyLayer(app.activeDocument, request.params);
        } else if (command === "merge_active_down") {
            response.data = mergeActiveDown(app.activeDocument);
        } else if (command === "merge_visible_layers") {
            response.data = mergeVisible(app.activeDocument);
        } else if (command === "duplicate_active_layer") {
            response.data = duplicateActiveLayer(app.activeDocument, request.params);
        } else if (command === "delete_active_layer") {
            response.data = deleteActiveLayer(app.activeDocument);
        } else if (command === "rename_active_layer") {
            response.data = renameActiveLayer(app.activeDocument, request.params);
        } else if (command === "set_active_layer_visibility") {
            response.data = setActiveLayerVisibility(app.activeDocument, request.params);
        } else if (command === "set_active_layer_opacity") {
            response.data = setActiveLayerOpacity(app.activeDocument, request.params);
        } else if (command === "set_active_layer_blend_mode") {
            response.data = setActiveLayerBlendMode(app.activeDocument, request.params);
        } else if (command === "select_all") {
            response.data = createSelectionAll(app.activeDocument);
        } else if (command === "deselect") {
            response.data = deselectSelection(app.activeDocument);
        } else if (command === "invert_selection") {
            response.data = invertSelection(app.activeDocument);
        } else if (command === "expand_selection") {
            response.data = expandSelection(app.activeDocument, request.params);
        } else if (command === "contract_selection") {
            response.data = contractSelection(app.activeDocument, request.params);
        } else if (command === "feather_selection") {
            response.data = featherSelection(app.activeDocument, request.params);
        } else if (command === "set_foreground_color") {
            response.data = setForegroundColor(request.params);
        } else if (command === "add_bezier_path") {
            response.data = addBezierPath(app.activeDocument, request.params);
        } else if (command === "stroke_path") {
            response.data = strokePathItem(app.activeDocument, request.params);
        } else if (command === "delete_path") {
            response.data = deletePathItem(app.activeDocument, request.params);
        } else if (command === "apply_layer_style") {
            response.data = applyLayerStyleByName(app.activeDocument, request.params);
        } else if (command === "set_active_layer") {
            response.data = setActiveLayer(app.activeDocument, request.params);
        } else if (command === "get_layer_bounds") {
            response.data = getLayerBounds(app.activeDocument, request.params);
        } else if (command === "check_layer_overlap") {
            response.data = checkLayerOverlap(app.activeDocument, request.params);
        } else if (command === "create_layer_group") {
            response.data = createLayerGroup(app.activeDocument, request.params);
        } else if (command === "move_layers_to_group") {
            response.data = moveLayersIntoGroup(app.activeDocument, request.params);
        } else if (command === "ungroup_layer_group") {
            response.data = ungroupLayerGroup(app.activeDocument, request.params);
        } else if (command === "add_levels_adjustment_layer") {
            response.data = addLevelsAdjustmentLayer(app.activeDocument, request.params);
        } else if (command === "add_curves_adjustment_layer") {
            response.data = addCurvesAdjustmentLayer(app.activeDocument, request.params);
        } else if (command === "add_hue_saturation_adjustment_layer") {
            response.data = addHueSaturationAdjustmentLayer(app.activeDocument, request.params);
        } else if (command === "add_black_white_adjustment_layer") {
            response.data = addBlackWhiteAdjustmentLayer(app.activeDocument, request.params);
        } else if (command === "add_solid_fill_layer") {
            response.data = addSolidFillLayer(app.activeDocument, request.params);
        } else if (command === "add_gradient_fill_layer") {
            response.data = addGradientFillLayer(app.activeDocument, request.params);
        } else if (command === "add_pattern_fill_layer") {
            response.data = addPatternFillLayer(app.activeDocument, request.params);
        } else if (command === "create_layer_mask") {
            response.data = createLayerMask(app.activeDocument, request.params);
        } else if (command === "apply_layer_mask") {
            response.data = applyLayerMask(app.activeDocument);
        } else if (command === "delete_layer_mask") {
            response.data = deleteLayerMask(app.activeDocument, request.params);
        } else if (command === "invert_layer_mask") {
            response.data = invertLayerMask(app.activeDocument);
        } else if (command === "set_clipping_mask") {
            response.data = setClippingMask(app.activeDocument, request.params);
        } else if (command === "create_clipping_mask") {
            response.data = setClippingMask(app.activeDocument, { enabled: true });
        } else if (command === "release_clipping_mask") {
            response.data = setClippingMask(app.activeDocument, { enabled: false });
        } else if (command === "add_shape_rect") {
            response.data = addShapeLayerRect(app.activeDocument, request.params);
        } else if (command === "add_shape_ellipse") {
            response.data = addShapeLayerEllipse(app.activeDocument, request.params);
        } else if (command === "transform_active_layer") {
            response.data = transformActiveLayer(app.activeDocument, request.params);
        } else if (command === "flip_active_layer_horizontal") {
            response.data = flipActiveLayer(app.activeDocument, "horizontal");
        } else if (command === "flip_active_layer_vertical") {
            response.data = flipActiveLayer(app.activeDocument, "vertical");
        } else if (command === "align_layers") {
            response.data = alignLayers(app.activeDocument, request.params);
        } else if (command === "distribute_layers") {
            response.data = distributeLayers(app.activeDocument, request.params);
        } else if (command === "place_image_as_layer") {
            response.data = placeImageAsLayer(app.activeDocument, request.params);
        } else if (command === "export_document") {
            response.data = exportActiveDocument(app.activeDocument, request.params);
        } else if (command === "export_preview") {
            response.data = exportPreview(app.activeDocument, request.params);
        } else if (command === "history_undo") {
            response.data = historyUndo();
        } else if (command === "history_redo") {
            response.data = historyRedo();
        } else {
            throw new Error("Unknown command: " + command);
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
})();
