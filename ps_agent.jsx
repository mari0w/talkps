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
        if (s.charAt(0) === "{" && typeof JSON !== "undefined" && JSON.parse) {
            try {
                var parsed = JSON.parse(s);
                return {
                    command: parsed.command || null,
                    params: parsed.params || {}
                };
            } catch (err) {
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
            colorProfile: doc.colorProfileName
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

    function addTextLayer(doc, params) {
        if (!params || !params.text) {
            throw new Error("Missing params.text");
        }

        var layer = doc.artLayers.add();
        layer.kind = LayerKind.TEXT;
        layer.name = params.name || "Text Layer";

        var textItem = layer.textItem;
        textItem.contents = params.text;

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

    var response = { ok: false, data: null, error: null };

    try {
        var raw = readFile(requestPath);
        var request = parseRequest(raw);
        var command = request.command;

        if (!command) {
            throw new Error("Missing command");
        }

        if (command !== "ping" && app.documents.length == 0) {
            throw new Error("No document open");
        }

        if (command === "ping") {
            response.data = { status: "ok", message: "pong" };
        } else if (command === "get_document_info") {
            response.data = getDocumentInfo(app.activeDocument);
        } else if (command === "list_layers") {
            response.data = listLayers(app.activeDocument);
        } else if (command === "list_fonts") {
            response.data = listFonts();
        } else if (command === "add_text_layer") {
            response.data = addTextLayer(app.activeDocument, request.params);
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
