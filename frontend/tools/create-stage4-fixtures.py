from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "stage4-fixtures"
OUT.mkdir(exist_ok=True)

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiMin-W3"))

normal = OUT / "text-japanese.pdf"
c = canvas.Canvas(str(normal))
c.setFont("HeiseiMin-W3", 18)
c.drawString(72, 760, "私は毎朝七時に起きます。図書館で日本語を勉強します。")
c.setFont("Helvetica", 14)
c.drawString(72, 720, "Japanese reading practice text for browser PDF extraction.")
c.save()

scanned = OUT / "scanned-image-only.pdf"
c = canvas.Canvas(str(scanned))
c.setFillColorRGB(0.15, 0.15, 0.15)
c.rect(72, 520, 460, 220, fill=1, stroke=0)
c.save()

reader = PdfReader(str(normal))
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
writer.encrypt("stage4-password")
with (OUT / "encrypted.pdf").open("wb") as handle:
    writer.write(handle)

(OUT / "corrupted.pdf").write_bytes(b"%PDF-1.7\ncorrupted-stage4-fixture\n%%EOF")

large = OUT / "over-20mb.pdf"
with large.open("wb") as handle:
    handle.write(b"%PDF-1.7\n")
    handle.seek(20 * 1024 * 1024 + 1024)
    handle.write(b"\n%%EOF")

print(OUT)
