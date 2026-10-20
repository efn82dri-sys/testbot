# قرارداد API و کارهای سمت سرور تجربه‌های پاکار

این سند مکمل `pakar-experiences-roadmap.md` است. API سمت سرور در ZIP تحویلی وجود ندارد؛ هیچ endpoint جدیدی در این بسته جعل یا شبیه‌سازی نشده است.

## قراردادهای پیشنهادی

تمام endpointها باید هویت را از `X-Init-Data` تلگرام اعتبارسنجی کنند؛ `user_id` ارسالی از کلاینت قابل اعتماد نیست. پاسخ خطا باید JSON با `ok:false` و `error` قابل‌نمایش برگرداند.

| Method | Path | هدف |
|---|---|---|
| GET | `/materials/api/community?cursor=&limit=15&type=&material=&sort=for_you%7Cnew` | فید صفحه‌بندی‌شده؛ سازگار با endpoint فعلی `community` |
| GET | `/materials/api/community-thread?id=` | پست اصلی و پاسخ‌های آن |
| POST | `/materials/api/community` `{action:"vote", id}` | رأی مفید فعلی؛ idempotent برای هر کاربر |
| POST | `/materials/api/community` `{action:"react", id, kind:"seen"\|"warn"}` | واکنش‌های قابل لغو |
| POST | `/materials/api/community` `{action:"reply", id, text, reply_to?}` | پاسخ با طول حداکثر ۸۰۰ نویسه |
| POST | `/materials/api/community` `{action:"follow_up", id, text, outcome:"held"\|"failed"\|"partial"}` | پیگیری نویسنده |
| POST | `/materials/api/community` `{action:"report", id, reply_id?, reason}` | گزارش محتوا |
| POST | `/materials/api/community-media` | آپلود تصویر فشرده WebP، سقف سخت ۱۵۰KB |
| GET | `/materials/api/community-trending?days=7` | مصالح/پست‌های پرتعامل بر اساس داده واقعی |

## قرارداد داده‌ی پست

فیلدهای قدیمی باید حفظ شوند: `id`, `type`, `title`, `details`, `material`, `context`, `photo_url`, `user`, `username`, `author_photo_url`, `expert_verified`, `votes`, `voted`, `created_at`, `status`. فیلدهای جدید اختیاری‌اند: `material_id`, `context_tags`, `media`, `level`, `reactions`, `my_reaction`, `reply_count`, `reply_preview`, `follow_ups`, `pinned`.

نبودن فیلدهای جدید باید به مقدار خالی/صفر تفسیر شود. فقط داده‌های تأییدشده در فید عمومی نمایش داده شوند.

## الزامات امنیت، کیفیت و عملیات

- بررسی `initData` سمت سرور؛ محدودیت نرخ ۵ پاسخ و ۱۰ واکنش در دقیقه برای هر کاربر.
- پاسخ‌ها حداکثر ۸۰۰ نویسه؛ گزارش محتوا، مخفی‌سازی پس از آستانه‌ی تعیین‌شده و ابزار رسیدگی مدیر.
- نویسنده فقط تا ۱۵ دقیقه امکان ویرایش/حذف پاسخ خود را داشته باشد.
- برای تصاویر از دیسک موقت سرویس میزبانی به‌عنوان ذخیره‌سازی دائمی استفاده نشود.
- شمارنده‌ها و رأی‌ها از منبع حقیقت سمت سرور خوانده شوند؛ عملیات واکنش idempotent باشد.
- هیچ پست، شمارنده، کاربر، نشان تخصص یا ترندی به‌صورت نمونه‌ای در محیط production تولید نشود.

## وضعیت

قابلیت‌های UI وابسته به این endpointها تا پیاده‌سازی و آزمون سرور، فعال‌شده محسوب نمی‌شوند: پاسخ/گفتگو، واکنش‌های `seen` و `warn`، گزارش و moderation پاسخ‌ها، آپلود رسانه، صفحه‌بندی cursor، ترند، Follow-up، نمایه‌ی ریسک محصول و نشان‌های مشارکت مبتنی بر فعالیت واقعی.
