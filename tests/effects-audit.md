# ممیزی افکت‌های CSS

در نسخه‌ی قبل، اعلان‌های blur/backdrop-filter در این انتخابگرها وجود داشتند؛ اکنون اعلان‌های فعال آن‌ها حذف شده‌اند و بودجه‌ی اجرایی صفر است:

- `.orb` — پس‌زمینه‌ی تزئینی در همه‌ی نماها؛ `filter: blur(90px)` حذف شد.
- `.app-bar` و `.bottom-nav` — مشترک در همه‌ی نماها؛ backdrop-filter حذف شد.
- `.icon-btn`, `.pill`, `.filters::after`, `.search-wrap`, `.search-wrap::after`, `.to-top`, `.toast`, `.mv-pill`, `.mv-nav` — اجزای مشترک/موقتی؛ backdrop-filter حذف شد.
- `.boot-screen` و `.sd-panel` — لودر و شیت؛ backdrop-filter حذف شد.
- `.low-power ...` — کلاس حفظ شده است و همچنان افکت‌های glass را خاموش می‌کند؛ از آنجا که blur فعال باقی نمانده، رفتار آن امن‌تر شده است.
- `.chip`, `.tool-card`, `.mc`, `.pr2`, `.sd-scrim`, `.nav-neon::after`, `.filters::after`, `.bg .orb` — overrideهای سراسری حفظ/ساده شده‌اند.

`python tests/measure_effects.py` در هر پنج نمای اصلی عدد `0/3` می‌دهد. حالت روشن/تیره از روی متغیرهای رنگ و نسبت کنتراست پایه بررسی ماشینی شده؛ ظاهر نهایی هنوز نیازمند بررسی دستی روی دستگاه واقعی است.
