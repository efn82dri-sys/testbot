"""Pure, dependency-free validation rules shared by the materials API and tests."""
import re

def verification_is_valid(value):
    if not isinstance(value, dict): return False
    url=str(value.get('datasheetUrl') or '').strip()
    page=str(value.get('page') or '').strip()
    date=str(value.get('reviewedAt') or '').strip()
    return bool(re.match(r'^https://', url, re.I) and re.fullmatch(r'[0-9۰-۹٠-٩]{1,4}', page) and re.fullmatch(r'(?:1[34][0-9۰-۹٠-٩]{2}[/\-][0-9۰-۹٠-٩]{1,2}[/\-][0-9۰-۹٠-٩]{1,2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})', date) and str(value.get('reviewer') or '').strip())

def license_is_valid(value):
    if not isinstance(value, dict): return False
    date=str(value.get('approvedAt') or '').strip()
    date_ok=bool(re.fullmatch(r'(?:1[34][0-9۰-۹٠-٩]{2}[/\-][0-9۰-۹٠-٩]{1,2}[/\-][0-9۰-۹٠-٩]{1,2}|20[0-9]{2}-[0-9]{2}-[0-9]{2})', date))
    return bool(str(value.get('source') or '').strip() and str(value.get('rightsHolder') or '').strip() and date_ok)

def has_product_image(product):
    if not isinstance(product, dict): return False
    if str(product.get('sourceImageUrl') or '').strip() or str(product.get('cdnImageUrl') or '').strip(): return True
    images=product.get('images')
    return isinstance(images, list) and any(isinstance(x,dict) and (x.get('key') or x.get('fid')) for x in images)

def product_is_publishable(product, mode="strict"):
    """mode="image": a real product image is enough (legacy behaviour).
    mode="strict": real image + verified datasheet review + approved media license."""
    if not has_product_image(product): return False
    if str(mode or "").strip().lower() != "strict": return True
    verification=product.get("verification") if isinstance(product.get("verification"),dict) else {}
    license_data=product.get("mediaLicense") if isinstance(product.get("mediaLicense"),dict) else {}
    return bool(
        product.get("confidence")=="verified"
        and verification_is_valid(verification)
        and license_data.get("status")=="approved"
        and license_is_valid(license_data)
    )

def visible_products(products, show_incomplete=False, mode="strict"):
    visible=[]
    for original in products if isinstance(products,list) else []:
        if not isinstance(original,dict): continue
        item=dict(original)
        if product_is_publishable(item, mode):
            item['publicationStatus']='published'
            visible.append(item)
        elif show_incomplete:
            item['publicationStatus']='incomplete'
            license_data=item.get('mediaLicense') if isinstance(item.get('mediaLicense'),dict) else {}
            if str(mode or '').strip().lower()=='strict' and (license_data.get('status')!='approved' or not license_is_valid(license_data)):
                # Never expose unapproved media even when the admin enables incomplete product cards.
                item.pop('images',None); item.pop('sourceImageUrl',None); item.pop('cdnImageUrl',None); item.pop('cdnLqip',None)
            visible.append(item)
    return visible

def media_gap_counts(companies):
    companies=companies if isinstance(companies,list) else []
    products=[(c,p) for c in companies if isinstance(c,dict) for p in (c.get('products') or []) if isinstance(p,dict)]
    return {
      'companies':len(companies),
      'missing_logos':sum(1 for c in companies if not isinstance(c.get('logo'),dict) or not (c.get('logo') or {}).get('key')),
      'missing_images':sum(1 for _,p in products if not has_product_image(p)),
      'unapproved_product_licenses':sum(1 for _,p in products if has_product_image(p) and ((p.get('mediaLicense') or {}).get('status')!='approved' or not license_is_valid(p.get('mediaLicense')))),
      'unapproved_logo_licenses':sum(1 for c in companies if isinstance(c.get('logo'),dict) and c.get('logo',{}).get('key') and ((c.get('logoLicense') or {}).get('status')!='approved' or not license_is_valid(c.get('logoLicense')))),
      'products':len(products),
    }


def parse_bulk_media_filename(value):
    """Parse the explicit ravaq-media path from filename or Telegram caption."""
    match = re.fullmatch(r"brands/([A-Za-z0-9_-]+)/products/([A-Za-z0-9_-]+)/([0-9]{2})\.webp", str(value or "").replace("\\", "/").strip())
    return match.groups() if match else None
