#target photoshop

app.bringToFront();

var originalRulerUnits = app.preferences.rulerUnits;
app.preferences.rulerUnits = Units.PIXELS;

// Create a new document
var doc = app.documents.add(800, 600, 72, "Demo Doc", NewDocumentMode.RGB, DocumentFill.WHITE);

// Create a red background layer
var bgLayer = doc.artLayers.add();
bgLayer.name = "Red Background";
doc.activeLayer = bgLayer;

var red = new SolidColor();
red.rgb.red = 255;
red.rgb.green = 0;
red.rgb.blue = 0;

doc.selection.selectAll();
doc.selection.fill(red);
doc.selection.deselect();

// Move background layer to bottom
bgLayer.move(doc, ElementPlacement.PLACEATEND);

// Add a text layer
var textLayer = doc.artLayers.add();
textLayer.kind = LayerKind.TEXT;
textLayer.textItem.contents = "Hello, World!";
textLayer.textItem.position = [160, 167];
textLayer.textItem.size = 40;

var green = new SolidColor();
green.rgb.red = 0;
green.rgb.green = 255;
green.rgb.blue = 0;
textLayer.textItem.color = green;

// Save as JPEG on Desktop
var jpgFile = new File(Folder.desktop + "/hello_world.jpg");
var opts = new JPEGSaveOptions();
opts.quality = 5;
doc.saveAs(jpgFile, opts, true, Extension.LOWERCASE);

alert("Saved to: " + jpgFile.fsName);

app.preferences.rulerUnits = originalRulerUnits;
