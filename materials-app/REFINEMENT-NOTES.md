# Ravaq UI refinement pass

## Changes
- Reduced mobile spacing, card height, badges, icon buttons, tool cards, guide headers and experience layout density.
- Hid the catalog-only hero and filters when a different main tab is active, preventing duplicate navigation and oversized header content on phone screens.
- Improved catalog search normalization for Persian/Arabic letter variants, Arabic/Persian digits, diacritics, punctuation and whitespace.
- Expanded search coverage to product/brand names, category, group, unit, descriptions, features, specifications, standards, sources, availability, and saved installation-guide text.
- Made brand logo shortcuts follow the current search query, so search filters both product results and brand shortcuts.
- Kept tool cards as the visual reference while giving guide and experience sections a tighter, consistent editorial hierarchy.
- Added reduced-motion support and narrower-screen safeguards for long labels and action controls.

## Validation
- `node --check script.js` passed.
- Search and rendering changes were syntax-checked. Visual validation should still be done inside Telegram WebView on 360px, 390px, dark and light themes.


## V6 — Field Guide spacing cleanup
- حذف نوار میانی «EXECUTION LIBRARY / پرونده‌های منطبق»؛ این بخش اطلاعات تکراری و بدون اقدام مشخص داشت و بین هدر و ابزار جست‌وجو فضای بی‌دلیل ایجاد می‌کرد.
- ترتیب نهایی: هدر راهنما → جست‌وجو/فیلتر → پرونده‌ها.
- فیلترها اکنون بلافاصله بعد از هدر قرار می‌گیرند.
