"""Independent check of synthetic artifacts. Requires the bundled pypdf runtime."""
from pathlib import Path
import hashlib
import json
import re
import sys
from pypdf import PdfReader

assert len(sys.argv) <= 2, "Expected at most one proof directory"
folder = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else Path(__file__).resolve().parents[1] / "output/pdf"
source_file = folder / "caronte-prueba-tecnica-fuente.json"
source = json.loads(source_file.read_text())
report = json.loads((folder / "caronte-prueba-tecnica-informe.json").read_text())
reader = PdfReader(folder / "caronte-prueba-tecnica-interior.pdf")
cover = PdfReader(folder / "caronte-prueba-tecnica-cubierta.pdf")
assert len(reader.pages) == report["pageCount"] and 180 <= len(reader.pages) <= 200
assert len(cover.pages) == 1
assert not reader.is_encrypted and not cover.is_encrypted
assert hashlib.sha256(source_file.read_bytes()).hexdigest() == report["sourceSha256"]
embedded = {}
for document in [reader, cover]:
    for page in document.pages:
        for reference in page["/Resources"].get("/Font", {}).values():
            font = reference.get_object()
            assert "/ToUnicode" in font
            assert font.get("/DescendantFonts"), "Non-embedded base font found"
            for descendant in font["/DescendantFonts"]:
                descriptor = descendant.get_object()["/FontDescriptor"].get_object()
                assert descriptor.get("/FontFile2") is not None
                embedded[str(descriptor["/FontName"])] = len(descriptor["/FontFile2"].get_data())
chapter_titles = [section["title"] for section in source["sections"]]
lines = []
for page in reader.pages[4:]:
    for line in page.extract_text().splitlines():
        if re.fullmatch(r"\d+|CAPÍTULO \d", line) or line in chapter_titles:
            continue
        lines.append(line)
actual = " ".join(" ".join(lines).split())
expected = " ".join(" ".join(paragraph for chapter in source["sections"]
                              for paragraph in chapter["paragraphs"]).split())
assert actual == expected, f"Full text extraction differs: {len(actual)} / {len(expected)}"
for name, key in [("interior", "interiorSha256"), ("cubierta", "coverSha256")]:
    assert hashlib.sha256((folder / f"caronte-prueba-tecnica-{name}.pdf").read_bytes()).hexdigest() == report[key]
for page in reader.pages:
    assert abs(float(page.mediabox.width) - 419.76) < 0.01
    assert abs(float(page.mediabox.height) - 595.44) < 0.01
geometry = report["coverDimensions"]
assert abs(float(cover.pages[0].mediabox.width) - geometry["width"]) < 0.01
assert abs(float(cover.pages[0].mediabox.height) - geometry["height"]) < 0.01
print(json.dumps({"independentCheck": "passed", "pages": len(reader.pages),
                  "coverPages": len(cover.pages), "fullTextCharacters": len(actual),
                  "embeddedFonts": embedded, "readyForPrint": False}, ensure_ascii=False))
