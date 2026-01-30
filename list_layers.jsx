#target photoshop

app.bringToFront();

if (app.documents.length === 0) {
    alert("No document open.");
} else {
    var originalRulerUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;

    try {
        var doc = app.activeDocument;
        var lines = [];

        lines.push("Document: " + doc.name);
        lines.push("Size: " + doc.width.as("px") + " x " + doc.height.as("px") + " px");
        lines.push("Resolution: " + doc.resolution);
        lines.push("Mode: " + doc.mode);
        lines.push("Layers:");

        function boundsToString(b) {
            return [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")].join(", ");
        }

        function walk(layer, depth) {
            var indent = new Array(depth + 1).join("  ");

            if (layer.typename === "LayerSet") {
                lines.push(indent + "[Group] " + layer.name + " (visible=" + layer.visible + ")");
                for (var i = 0; i < layer.layers.length; i++) {
                    walk(layer.layers[i], depth + 1);
                }
                return;
            }

            var kind = layer.kind ? layer.kind.toString() : "Unknown";
            var opacity = (layer.opacity !== undefined) ? layer.opacity : "N/A";
            var blend = layer.blendMode ? layer.blendMode.toString() : "N/A";
            var bounds = layer.bounds ? boundsToString(layer.bounds) : "N/A";

            lines.push(
                indent + "- " + layer.name +
                " | kind=" + kind +
                " | visible=" + layer.visible +
                " | opacity=" + opacity +
                " | blend=" + blend +
                " | bounds=" + bounds
            );
        }

        for (var i = 0; i < doc.layers.length; i++) {
            walk(doc.layers[i], 0);
        }

        var outFile = new File(Folder.desktop + "/ps_layers.txt");
        outFile.open("w");
        outFile.write(lines.join("\n"));
        outFile.close();

        alert("Layer info saved to: " + outFile.fsName);
    } catch (err) {
        alert("Error: " + err);
    } finally {
        app.preferences.rulerUnits = originalRulerUnits;
    }
}
