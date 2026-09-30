import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from materials_catalog_rules import verification_is_valid, license_is_valid, has_product_image, visible_products, media_gap_counts, parse_bulk_media_filename, product_is_publishable

def test_verification_requires_all_fields():
    assert not verification_is_valid({"datasheetUrl":"https://example.org/data.pdf", "page":"2", "reviewedAt":"1405/07/10", "reviewer":""})
    assert not verification_is_valid({"datasheetUrl":"http://example.org/data.pdf", "page":"2", "reviewedAt":"1405/07/10", "reviewer":"بازبین"})
    assert verification_is_valid({"datasheetUrl":"https://example.org/data.pdf", "page":"2", "reviewedAt":"1405/07/10", "reviewer":"بازبین"})

def test_license_requires_source_holder_and_date():
    assert not license_is_valid({"source":"کاتالوگ", "rightsHolder":"", "approvedAt":"1405/07/10"})
    assert license_is_valid({"source":"سند اجازه استفاده", "rightsHolder":"شرکت نمونه", "approvedAt":"1405/07/10"})

def test_public_catalog_requires_image_verification_and_license():
    ready={"id":"ready","sourceImageUrl":"/materials/images/a.webp","confidence":"verified","verification":{"datasheetUrl":"https://example.org/data.pdf","page":"2","reviewedAt":"1405/07/10","reviewer":"بازبین"},"mediaLicense":{"status":"approved","source":"سند اجازه","rightsHolder":"دارنده حق","approvedAt":"1405/07/10"}}
    products=[ready,{"id":"image-only","sourceImageUrl":"/materials/images/b.webp"},{"id":"no-image"}]
    assert [p['id'] for p in visible_products(products, False)] == ['ready']
    visible=visible_products(products, True)
    assert [p['id'] for p in visible] == ['ready','image-only','no-image']
    assert visible[1]['publicationStatus']=='incomplete' and visible[2]['publicationStatus']=='incomplete'
    assert 'sourceImageUrl' not in visible[1] and 'images' not in visible[1], 'unapproved media must not be exposed even for incomplete products'
    assert product_is_publishable(ready)
    assert not product_is_publishable(products[1])


def test_media_gaps_count_products_and_logos():
    report=media_gap_counts([{"id":"x","products":[{"id":"a"},{"id":"b","images":[{"key":"x"}]}]}])
    assert report['missing_logos']==1
    assert report['missing_images']==1
    assert report['products']==2
    assert report['unapproved_product_licenses']==1


def test_bulk_media_path_requires_contract_and_returns_ids():
    assert parse_bulk_media_filename("brands/leca/products/leca1/01.webp") == ("leca", "leca1", "01")
    assert parse_bulk_media_filename("brands/leca/products/leca1/1.webp") is None
    assert parse_bulk_media_filename("brands/leca/products/../01.webp") is None
    assert parse_bulk_media_filename("https://example.com/image.webp") is None
