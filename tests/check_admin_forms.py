#!/usr/bin/env python3
"""Static sanity checks for required in-app admin forms and server validation hooks."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
js=(root/'materials-app/script.js').read_text(encoding='utf-8'); py=(root/'main.py').read_text(encoding='utf-8')
for field in ('verifyUrl','verifyPage','verifyDate','verifyReviewer','licenseSource','licenseHolder','licenseDate'):
 assert f'id=\"{field}\"' in js, f'missing form field: {field}'
for hook in ("case 'verify-submit'", "case 'license-submit'"):
 assert hook in js, f'missing submit handler: {hook}'
assert 'verification_is_valid' in py and 'license_is_valid' in py
print('PASS: in-app verification/license forms and server-side validation hooks are present')
