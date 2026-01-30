#target photoshop

(function () {
    var requestPath = "/Users/charles/photoshop/ps_request.json";
    var responsePath = "/Users/charles/photoshop/ps_response.json";

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

    function getCommand(raw) {
        var s = trim(raw);
        if (s === "") {
            return null;
        }
        // Try JSON-style: {"command":"list_layers"}
        var jsonCmd = extractJsonCommand(s);
        if (jsonCmd) {
            return jsonCmd;
        }
        // Try simple style: command=list_layers
        if (s.indexOf("command=") === 0) {
            return trim(s.substring(8));
        }
        return s;
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

    var response = { ok: false, data: null, error: null };

    try {
        if (app.documents.length == 0) {
            throw new Error("No document open");
        }

        var raw = readFile(requestPath);
        var command = getCommand(raw);
        var doc = app.activeDocument;

        if (!command) {
            throw new Error("Missing command");
        }

        if (command === "get_document_info") {
            response.data = getDocumentInfo(doc);
        } else if (command === "list_layers") {
            response.data = listLayers(doc);
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
