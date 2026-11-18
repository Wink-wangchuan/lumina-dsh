// Warm-up script executed by ps-helper.ps1 right after Photoshop reports ready.
//
// Photoshop 28 (2027) fails the FIRST document/file operation of a freshly
// started host with the generic error
//   "A general Photoshop error occurred. This functionality may not be available
//    in this version of Photoshop." (Chinese UI: 发生了常规 Photoshop 错误...)
// even for a perfectly valid document; the very same call succeeds a moment
// later. It is a cold-start race in the document subsystem, not a path problem
// (both C:/x/y.png and C:\x\y.png open fine once warm).
//
// Creating and discarding a scratch document burns the race so that Lumina's
// first real call always lands on a warm host.
//
// Note: the failing attempt can leave its document behind (the error is raised
// around the creation), so every round sweeps any leftover "lumina-warmup*"
// document. Only documents carrying that name are ever closed — the user's own
// open files are never touched.
(function () {
    var NAME = 'lumina-warmup';

    function sweep() {
        for (var i = app.documents.length - 1; i >= 0; i--) {
            var d = app.documents[i];
            if (String(d.name).indexOf(NAME) === 0) {
                try { d.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
            }
        }
    }

    var last = null;
    for (var round = 0; round < 20; round++) {
        try {
            var w = app.documents.add(4, 4, 72, NAME, NewDocumentMode.RGB, DocumentFill.WHITE);
            try { w.close(SaveOptions.DONOTSAVECHANGES); } catch (eCloseMain) {}
            sweep();
            return 'warm|tries=' + (round + 1);
        } catch (e) {
            last = e;
            sweep();
        }
        try { $.sleep(400); } catch (eSleep) {}
    }
    return 'warm-failed|' + ((last && last.message) || last);
})();