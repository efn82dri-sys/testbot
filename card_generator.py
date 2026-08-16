# -*- coding: utf-8 -*-
"""
ماژول تولید کارت عضویت تصویری «رواق»
نسخه 3.0 - کاملاً مستقل با توابع کمکی
"""

import io
import logging
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode
from aiogram.types import BufferedInputFile

logger = logging.getLogger(__name__)

# ---------- تنظیمات مسیرها ----------
BASE_DIR = Path(__file__).parent
FONTS_DIR = BASE_DIR / "fonts"
ASSETS_DIR = BASE_DIR / "assets"
FONTS_DIR.mkdir(exist_ok=True, parents=True)
ASSETS_DIR.mkdir(exist_ok=True, parents=True)

# ---------- توابع کمکی ----------
def to_persian_num(num) -> str:
    mapping = {
        '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
        '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
    }
    return ''.join(mapping.get(ch, ch) for ch in str(num))

def get_font(name: str, size: int):
    font_path = FONTS_DIR / name
    if font_path.exists():
        try:
            return ImageFont.truetype(str(font_path), size)
        except Exception:
            pass
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except:
        return ImageFont.load_default()

def load_asset(name: str):
    asset_path = ASSETS_DIR / name
    if asset_path.exists():
        try:
            return Image.open(asset_path).convert("RGBA")
        except Exception:
            pass
    return None

# ---------- تابع اصلی تولید کارت ----------
async def generate_membership_card(
    user,
    data: dict,
    member_count: int,
    jalali_now: str,
    profile_image: Optional[Image.Image] = None,
    qr_data: Optional[str] = None,
) -> BufferedInputFile:
    """
    تولید کارت عضویت تصویری با ابعاد استوری اینستاگرام.
    
    Args:
        user: شیء کاربر تلگرام (با attributes: id, first_name, last_name, username, full_name)
        data: اطلاعات فرم شامل education_label, interests
        member_count: شماره‌ی عضویت (تعداد اعضای فعلی)
        jalali_now: تاریخ شمسی فعلی
        profile_image: تصویر پروفایل کاربر (اختیاری)
        qr_data: محتوای QR Code (لینک دعوت یا اینستاگرام)
    
    Returns:
        BufferedInputFile: تصویر کارت آماده برای ارسال به تلگرام
    """
    
    CARD_WIDTH = 1080
    CARD_HEIGHT = 1920
    
    COLORS = {
        "bg_primary": (10, 15, 26),
        "bg_secondary": (19, 31, 51),
        "gold": (201, 168, 76),
        "gold_light": (240, 208, 128),
        "gold_dark": (184, 148, 58),
        "white": (255, 255, 255),
        "cream": (232, 224, 208),
    }
    
    card = Image.new('RGB', (CARD_WIDTH, CARD_HEIGHT), COLORS["bg_primary"])
    draw = ImageDraw.Draw(card)
    
    # گرادیان پس‌زمینه
    for y in range(CARD_HEIGHT):
        center_x = CARD_WIDTH // 2
        center_y = int(CARD_HEIGHT * 0.4)
        dist = ((y - center_y) ** 2) ** 0.5
        max_dist = CARD_HEIGHT * 0.6
        ratio = min(1.0, dist / max_dist)
        r = int(COLORS["bg_secondary"][0] * (1 - ratio) + COLORS["bg_primary"][0] * ratio)
        g = int(COLORS["bg_secondary"][1] * (1 - ratio) + COLORS["bg_primary"][1] * ratio)
        b = int(COLORS["bg_secondary"][2] * (1 - ratio) + COLORS["bg_primary"][2] * ratio)
        draw.line([(0, y), (CARD_WIDTH, y)], fill=(r, g, b))
    
    # بافت معماری (اختیاری)
    pattern = load_asset("pattern.png")
    if pattern:
        pattern = pattern.resize((CARD_WIDTH, CARD_HEIGHT)).convert('RGBA')
        pattern.putalpha(20)
        card = Image.alpha_composite(card.convert('RGBA'), pattern).convert('RGB')
    
    # حاشیه‌های طلایی
    margin = 40
    draw.rectangle(
        [(margin, margin), (CARD_WIDTH - margin, CARD_HEIGHT - margin)],
        outline=COLORS["gold"],
        width=4,
    )
    margin2 = 56
    draw.rectangle(
        [(margin2, margin2), (CARD_WIDTH - margin2, CARD_HEIGHT - margin2)],
        outline=COLORS["gold_light"],
        width=1,
    )
    
    # لوگو
    logo = load_asset("logo.png")
    if logo:
        logo = logo.resize((80, 80))
        card.paste(logo, (CARD_WIDTH - 120, 40), logo)
    else:
        draw.text(
            (CARD_WIDTH - 60, 60),
            "🏛",
            font=get_font("Kalameh-Bold.ttf", 50),
            fill=COLORS["gold"],
            anchor="mt",
        )
    
    # عنوان
    draw.text(
        (80, 120),
        "کارت عضویت",
        font=get_font("Kalameh-Bold.ttf", 56),
        fill=COLORS["gold"],
    )
    draw.text(
        (80, 180),
        "رواق",
        font=get_font("Kalameh-Bold.ttf", 72),
        fill=COLORS["gold_light"],
    )
    draw.line(
        [(80, 220), (400, 220)],
        fill=COLORS["gold"],
        width=2,
    )
    
    # عکس پروفایل
    avatar_size = 260
    avatar_x = CARD_WIDTH // 2 - avatar_size // 2
    avatar_y = 320
    
    if profile_image:
        profile = profile_image.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
        mask = Image.new('L', (avatar_size, avatar_size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.ellipse((0, 0, avatar_size, avatar_size), fill=255)
        profile.putalpha(mask)
        
        glow_size = avatar_size + 40
        glow_mask = Image.new('L', (glow_size, glow_size), 0)
        glow_draw = ImageDraw.Draw(glow_mask)
        glow_draw.ellipse((0, 0, glow_size, glow_size), fill=255)
        glow_img = Image.new('RGB', (glow_size, glow_size), COLORS["gold_light"])
        glow_img.putalpha(20)
        
        border_size = avatar_size + 16
        border_mask = Image.new('L', (border_size, border_size), 0)
        border_draw = ImageDraw.Draw(border_mask)
        border_draw.ellipse((0, 0, border_size, border_size), fill=255)
        border_img = Image.new('RGB', (border_size, border_size), COLORS["gold"])
        border_img.putalpha(border_mask)
        
        glow_x = avatar_x - 20
        glow_y = avatar_y - 20
        card.paste(glow_img, (glow_x, glow_y), glow_img)
        border_x = avatar_x - 8
        border_y = avatar_y - 8
        card.paste(border_img, (border_x, border_y), border_img)
        card.paste(profile, (avatar_x, avatar_y), profile)
    else:
        draw.ellipse(
            [(avatar_x, avatar_y), (avatar_x + avatar_size, avatar_y + avatar_size)],
            fill=COLORS["bg_secondary"],
            outline=COLORS["gold"],
            width=6,
        )
        draw.text(
            (CARD_WIDTH // 2, avatar_y + avatar_size // 2),
            "👷",
            font=get_font("Kalameh-Bold.ttf", 80),
            fill=COLORS["gold_light"],
            anchor="mm",
        )
    
    # نام کاربر
    display_name = user.full_name or user.first_name or "کاربر"
    name_y = avatar_y + avatar_size + 60
    name_font = get_font("Kalameh-Bold.ttf", 64)
    draw.text(
        (CARD_WIDTH // 2 + 4, name_y + 4),
        display_name,
        font=name_font,
        fill=(0, 0, 0, 100),
        anchor="mt",
    )
    draw.text(
        (CARD_WIDTH // 2, name_y),
        display_name,
        font=name_font,
        fill=COLORS["white"],
        anchor="mt",
    )
    
    # قاب شیشه‌ای
    glass_width = 840
    glass_height = 340
    glass_x = (CARD_WIDTH - glass_width) // 2
    glass_y = name_y + 90
    
    glass = Image.new('RGBA', (glass_width, glass_height), (0, 0, 0, 0))
    glass_draw = ImageDraw.Draw(glass)
    glass_draw.rounded_rectangle(
        (0, 0, glass_width, glass_height),
        radius=24,
        fill=(255, 255, 255, 15),
    )
    glass_draw.rounded_rectangle(
        (0, 0, glass_width, glass_height),
        radius=24,
        outline=(COLORS["gold"][0], COLORS["gold"][1], COLORS["gold"][2], 80),
        width=2,
    )
    
    shadow = Image.new('RGBA', (glass_width + 20, glass_height + 20), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (10, 10, glass_width + 10, glass_height + 10),
        radius=28,
        fill=(0, 0, 0, 30),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=10))
    
    card.paste(shadow, (glass_x - 10, glass_y - 10), shadow)
    card.paste(glass, (glass_x, glass_y), glass)
    
    # متن‌های داخل قاب
    info_font = get_font("Kalameh-Regular.ttf", 38)
    info_small_font = get_font("Kalameh-Regular.ttf", 32)
    info_y_start = glass_y + 50
    x_start = glass_x + 60
    
    member_text = f"شماره‌ی عضویت: {to_persian_num(member_count)}"
    draw.text(
        (x_start, info_y_start),
        member_text,
        font=info_font,
        fill=COLORS["gold_light"],
    )
    
    edu_label = data.get("education_label", "کارشناسی")
    draw.text(
        (x_start, info_y_start + 65),
        f"🎓 {edu_label}",
        font=info_font,
        fill=COLORS["cream"],
    )
    
    # ===== اصلاح: تبدیل set به list =====
    interests_raw = data.get("interests", [])
    interests = list(interests_raw) if not isinstance(interests_raw, list) else interests_raw
    interests_text = "، ".join(interests[:3])
    if len(interests) > 3:
        interests_text += "، ..."
    draw.text(
        (x_start, info_y_start + 130),
        f"⭐️ {interests_text}",
        font=info_small_font,
        fill=COLORS["cream"],
    )
    # ===== پایان اصلاح =====
    
    date_text = f"🗓 {jalali_now}"
    date_font = get_font("Kalameh-Regular.ttf", 30)
    draw.text(
        (glass_x + glass_width - 60, info_y_start + 180),
        date_text,
        font=date_font,
        fill=COLORS["gold_light"],
        anchor="rt",
    )
    
    # QR Code
    if qr_data:
        qr_size = 240
        qr_x = CARD_WIDTH // 2 - qr_size // 2
        qr_y = glass_y + glass_height + 100
        
        qr = qrcode.QRCode(
            version=2,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=12,
            border=2,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#c9a84c", back_color="white").convert('RGBA')
        qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)
        
        container_size = qr_size + 60
        container = Image.new('RGBA', (container_size, container_size), (0, 0, 0, 0))
        container_draw = ImageDraw.Draw(container)
        container_draw.rounded_rectangle(
            (0, 0, container_size, container_size),
            radius=16,
            fill=(255, 255, 255, 15),
            outline=(COLORS["gold"][0], COLORS["gold"][1], COLORS["gold"][2], 100),
            width=2,
        )
        qr_offset = (container_size - qr_size) // 2
        container.paste(qr_img, (qr_offset, qr_offset), qr_img)
        
        container_x = qr_x - 30
        container_y = qr_y - 30
        card.paste(container, (container_x, container_y), container)
        
        draw.text(
            (CARD_WIDTH // 2, qr_y + container_size + 30),
            "اسکن کنید و به جمع معماران بپیوندید",
            font=get_font("Kalameh-Regular.ttf", 28),
            fill=COLORS["gold_light"],
            anchor="mt",
        )
    
    # فوتر
    footer_y = CARD_HEIGHT - 60
    draw.text(
        (CARD_WIDTH // 2, footer_y),
        "— تیم رواق 🏛",
        font=get_font("Kalameh-Regular.ttf", 28),
        fill=COLORS["gold_light"],
        anchor="mb",
    )
    
    output = io.BytesIO()
    card.save(output, format='PNG', quality=95, optimize=True)
    output.seek(0)
    return BufferedInputFile(output.read(), filename="membership_card.png")