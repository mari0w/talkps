import os
import photoshop.api as ps


def main():
    app = ps.Application()
    doc = app.documents.add()
    new_doc = doc.artLayers.add()

    text_color = ps.SolidColor()
    text_color.rgb.red = 0
    text_color.rgb.green = 255
    text_color.rgb.blue = 0

    new_text_layer = new_doc
    new_text_layer.kind = ps.LayerKind.TextLayer
    new_text_layer.textItem.contents = "Hello, World!"
    new_text_layer.textItem.position = [160, 167]
    new_text_layer.textItem.size = 40
    new_text_layer.textItem.color = text_color

    options = ps.JPEGSaveOptions(quality=5)
    jpg = os.path.expanduser("~/Desktop/hello_world.jpg")
    doc.saveAs(jpg, options, asCopy=True)
    app.doJavaScript(f'alert("save to jpg: {jpg}")')


if __name__ == "__main__":
    main()
