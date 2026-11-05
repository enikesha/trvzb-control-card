"""Bundle card-owned localization into the self-contained interactive preview."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
catalogs = {code: json.loads((root / f"src/locales/{code}.json").read_text()) for code in ("en", "ru")}
helpers = (root / "src/localize.js").read_text().replace("export function ", "function ")
translations = json.dumps(catalogs, ensure_ascii=False).replace("<", "\\u003c")
source = (root / "prototype/control.template.html").read_text()
assert source.count("/* @localization */") == 1
source = source.replace("/* @localization */", f"const catalogs = {translations};\n{helpers}")
(root / "prototype/control.html").write_text(source)
print("Built prototype/control.html (English + Russian)")
