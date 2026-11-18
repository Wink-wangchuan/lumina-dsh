/**
 * Build a pixel-level person alpha PNG from Photoshop's AI subject selection.
 *
 * Copy the selected subject into a transparent document and save it as PNG: the
 * result is an RGBA cutout whose alpha channel is a per-pixel person matte
 * (native resolution, antialiased edges). Used by grade.js to:
 *   - subtract the person from every colour/channel zone mask (pixel-level), so
 *     skin / white clothes / hair are ONLY affected by the person zone;
 *   - drive the person zone itself through the existing soft-alpha pipeline.
 */
import { toPsPath } from './jsx.js'

export function buildPersonMaskJsx({ input, output, crop = null, feather = 0 } = {}) {
  // PS 28 rejects forward-slash paths in app.open(); toPsPath() hands over
  // native separators on Windows (idempotent, so double-normalising is safe).
  const srcPath = toPsPath(input)
  const outPath = toPsPath(output)
  const cropCode = Array.isArray(crop) && crop.length === 4
    ? `doc.crop([${crop.map((value) => Math.round(Number(value))).join(',')}]);`
    : ''
  const featherCode = Number(feather) > 0 ? `try { doc.selection.feather(${Number(feather)}); } catch (e) {}` : ''
  return `#target photoshop
(function () {
    // PS 28 fails the first document operation of a freshly started host with the
    // generic "general Photoshop error" even for a valid file; retry briefly and
    // drop any document a failed attempt left behind.
    function closeExtraPS(before) {
        while (app.documents.length > before) {
            try { app.documents[app.documents.length - 1].close(SaveOptions.DONOTSAVECHANGES); } catch (e) { break; }
        }
    }
    function openDocPS(p) {
        var last = null;
        var before = app.documents.length;
        for (var round = 0; round < 8; round++) {
            try { return app.open(new File(p)); } catch (e) {
                last = e;
                closeExtraPS(before);
                try { $.sleep(300); } catch (eSleep) {}
            }
        }
        throw new Error('open failed [' + p + ']: ' + ((last && last.message) || last));
    }
    var src = openDocPS(${JSON.stringify(String(srcPath))});
    var doc = src;
    ${cropCode}
    try {
        executeAction(stringIDToTypeID("autoCutout"), undefined, DialogModes.NO);
    } catch (e) {
        throw new Error('Select Subject failed: ' + e.message);
    }
    ${featherCode}
    doc.selection.copy();
    var w = Math.round(doc.width.as('px'));
    var h = Math.round(doc.height.as('px'));
    var maskDoc = app.documents.add(w, h, doc.resolution, 'lumina-person-mask', NewDocumentMode.RGB, DocumentFill.TRANSPARENT, 1.0, BitsPerChannelType.EIGHT);
    app.activeDocument = maskDoc;
    maskDoc.paste();
    var pngOpt = new PNGSaveOptions();
    pngOpt.interlaced = false;
    maskDoc.saveAs(new File(${JSON.stringify(String(outPath))}), pngOpt, true, Extension.LOWERCASE);
    maskDoc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
    doc.close(SaveOptions.DONOTSAVECHANGES);
    return 'OK|person-mask';
})();`
}
