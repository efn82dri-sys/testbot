# -*- coding: utf-8 -*-
"""
ماژول تولید کارت عضویت تصویری «رواق» - نسخه حرفه‌ای
طراحی شده با الهام از هویت معماری و برند رواق
"""

import io
import logging
from pathlib import Path
from typing import Optional
import math

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageOps
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
    # Fallback
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

def create_rounded_rect(size, radius, color, outline_color=None, outline_width=0):
    """ایجاد مستطیل با گوشه‌های گرد و قابلیت حاشیه"""
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=color, outline=outline_color, width=outline_width)
    return img

def apply_glow_effect(image, radius=20, intensity=0.5):
    """افکت درخشش نرم"""
    glow = image.filter(ImageFilter.GaussianBlur(radius=radius))
    return Image.blend(image, glow, intensity)

def create_gradient(width, height, colors):
    """ایجاد گرادیان عمودی با چند رنگ"""
    img = Image.new('RGBA', (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        ratio = y / height
        # پیدا کردن دو رنگ مناسب در بازه
        segment = ratio * (len(colors) - 1)
        idx = int(segment)
        frac = segment - idx
        if idx >= len(colors) - 1:
            r, g, b = colors[-1]
        else:
            c1, c2 = colors[idx], colors[idx + 1]
            r = int(c1[0] + (c2[0] - c1[0]) * frac)
            g = int(c1[1] + (c2[1] - c1[1]) * frac)
            b = int(c1[2] + (c2[2] - c1[2]) * frac)
        draw.line((0, y, width, y), fill=(r, g, b))
    return img

def draw_arch_pattern(draw, x, y, width, height, color, opacity=30):
    """الگوی ساده قوس معماری"""
    # یک سری قوس کوچک تزئینی
    for i in range(0, width, 40):
        draw.arc((x + i, y - 20, x + i + 40, y + 40), 0, 180, fill=color + (opacity,), width=2)
        draw.arc((x + i + 10, y - 10, x + i + 30, y + 30), 0, 180, fill=color + (opacity//2,), width=1)

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
    تولید کارت عضویت تصویری حرفه‌ای با ابعاد استوری اینستاگرام
    """
    
    CARD_WIDTH = 1080
    CARD_HEIGHT = 1920
    
    # پالت رنگی اصلی برند
    COLORS = {
        "bg_top": (10, 15, 26),        # #0a0f1a
        "bg_mid": (15, 25, 45),        # #0f192d
        "bg_bottom": (20, 35, 60),     # #14233c
        "gold": (212, 175, 55),        # #d4af37
        "gold_dark": (180, 148, 45),   # #b4942d
        "gold_light": (240, 215, 120), # #f0d778
        "gold_glow": (255, 235, 180, 60),
        "white": (255, 255, 255),
        "cream": (245, 240, 230),
        "glass_bg": (255, 255, 255, 12),
        "glass_border": (212, 175, 55, 60),
        "shadow": (0, 0, 0, 100),
        "text_muted": (180, 190, 210),
    }
    
    # ===== ۱. ایجاد بوم با گرادیان پیشرفته =====
    bg_gradient = create_gradient(CARD_WIDTH, CARD_HEIGHT, [
        COLORS["bg_top"],
        COLORS["bg_mid"],
        COLORS["bg_bottom"]
    ])
    card = bg_gradient.convert('RGBA')
    draw = ImageDraw.Draw(card)
    
    # ===== ۲. لایه بافت معماری (اختیاری) =====
    pattern = load_asset("pattern.png")
    if pattern:
        pattern = pattern.resize((CARD_WIDTH, CARD_HEIGHT)).convert('RGBA')
        pattern.putalpha(15)  # شفافیت بالا
        card = Image.alpha_composite(card, pattern)
        draw = ImageDraw.Draw(card)
    
    # ===== ۳. خطوط هندسی معماری (پس‌زمینه) =====
    # خطوط عمودی نازک
    for x in range(0, CARD_WIDTH, 80):
        draw.line((x, 0, x, CARD_HEIGHT), fill=(255, 255, 255, 6), width=1)
    # خطوط افقی نازک
    for y in range(0, CARD_HEIGHT, 80):
        draw.line((0, y, CARD_WIDTH, y), fill=(255, 255, 255, 6), width=1)
    
    # ===== ۴. قاب بیرونی با گوشه‌های گرد =====
    outer_frame = create_rounded_rect(
        (CARD_WIDTH - 40, CARD_HEIGHT - 40),
        radius=30,
        color=(0, 0, 0, 0),
        outline_color=COLORS["gold"] + (150,),
        outline_width=3
    )
    card.paste(outer_frame, (20, 20), outer_frame)
    
    # قاب دوم (نازک‌تر)
    inner_frame = create_rounded_rect(
        (CARD_WIDTH - 60, CARD_HEIGHT - 60),
        radius=24,
        color=(0, 0, 0, 0),
        outline_color=COLORS["gold_light"] + (80,),
        outline_width=1
    )
    card.paste(inner_frame, (30, 30), inner_frame)
    
    # ===== ۵. المان‌های تزئینی بالای کارت =====
    # خط طلایی کوتاه در بالا
    draw.line((60, 90, 220, 90), fill=COLORS["gold"], width=3)
    draw.line((60, 96, 160, 96), fill=COLORS["gold_light"], width=2)
    
    # ===== ۶. لوگو و عنوان =====
    # بارگذاری لوگو
    logo = load_asset("logo.png")
    if logo:
        logo = logo.resize((90, 90))
        card.paste(logo, (60, 50), logo)
    else:
        # لوگوی متنی با آیکون طاق
        draw.text((80, 65), "🏛", font=get_font("Kalameh-Bold.ttf", 52), fill=COLORS["gold"])
    
    # عنوان «رواق»
    draw.text(
        (170, 65),
        "رواق",
        font=get_font("Kalameh-Bold.ttf", 52),
        fill=COLORS["gold_light"],
    )
    
    # زیرنویس
    draw.text(
        (170, 125),
        "مرجع فایل‌های معماری و عمران",
        font=get_font("Kalameh-Regular.ttf", 28),
        fill=COLORS["text_muted"],
    )
    
    # ===== ۷. عکس پروفایل با افکت درخشش =====
    avatar_size = 280
    avatar_x = CARD_WIDTH // 2 - avatar_size // 2
    avatar_y = 240
    
    if profile_image:
        # تغییر اندازه و برش دایره‌ای
        profile = profile_image.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
        mask = Image.new('L', (avatar_size, avatar_size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.ellipse((0, 0, avatar_size, avatar_size), fill=255)
        profile.putalpha(mask)
        
        # حلقه درخشش (گلوریا)
        glow_size = avatar_size + 60
        glow_img = Image.new('RGBA', (glow_size, glow_size), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_img)
        for i in range(20, 0, -2):
            alpha = int(30 * (i / 20))
            glow_draw.ellipse(
                (glow_size//2 - i*2, glow_size//2 - i*2, glow_size//2 + i*2, glow_size//2 + i*2),
                outline=COLORS["gold_light"] + (alpha,),
                width=2
            )
        glow_x = avatar_x - 30
        glow_y = avatar_y - 30
        card.paste(glow_img, (glow_x, glow_y), glow_img)
        
        # حاشیه طلایی با ضخامت دوگانه
        border_size = avatar_size + 20
        border_mask = Image.new('L', (border_size, border_size), 0)
        border_draw = ImageDraw.Draw(border_mask)
        border_draw.ellipse((0, 0, border_size, border_size), fill=255)
        
        # حاشیه بیرونی (طلایی پررنگ)
        border_outer = Image.new('RGBA', (border_size, border_size), (0, 0, 0, 0))
        border_outer_draw = ImageDraw.Draw(border_outer)
        border_outer_draw.ellipse((0, 0, border_size, border_size), fill=COLORS["gold"] + (200,))
        border_outer.putalpha(border_mask)
        
        # حاشیه داخلی (طلایی روشن)
        border_inner_size = avatar_size + 8
        border_inner_mask = Image.new('L', (border_inner_size, border_inner_size), 0)
        border_inner_draw = ImageDraw.Draw(border_inner_mask)
        border_inner_draw.ellipse((0, 0, border_inner_size, border_inner_size), fill=255)
        border_inner = Image.new('RGBA', (border_inner_size, border_inner_size), (0, 0, 0, 0))
        border_inner_draw = ImageDraw.Draw(border_inner)
        border_inner_draw.ellipse((0, 0, border_inner_size, border_inner_size), fill=COLORS["gold_light"] + (220,))
        border_inner.putalpha(border_inner_mask)
        
        # قرار دادن روی کارت
        border_x = avatar_x - 10
        border_y = avatar_y - 10
        card.paste(border_outer, (border_x, border_y), border_outer)
        border_x_inner = avatar_x - 4
        border_y_inner = avatar_y - 4
        card.paste(border_inner, (border_x_inner, border_y_inner), border_inner)
        # عکس نهایی
        card.paste(profile, (avatar_x, avatar_y), profile)
    else:
        # آواتار پیش‌فرض با طراحی خاص
        draw.ellipse(
            [(avatar_x, avatar_y), (avatar_x + avatar_size, avatar_y + avatar_size)],
            fill=(30, 50, 80),
            outline=COLORS["gold"],
            width=6,
        )
        draw.ellipse(
            [(avatar_x + 8, avatar_y + 8), (avatar_x + avatar_size - 8, avatar_y + avatar_size - 8)],
            outline=COLORS["gold_light"],
            width=2,
        )
        draw.text(
            (CARD_WIDTH // 2, avatar_y + avatar_size // 2),
            "👤",
            font=get_font("Kalameh-Bold.ttf", 100),
            fill=COLORS["gold_light"],
            anchor="mm",
        )
    
    # ===== ۸. نام کاربر (با سایه‌ی حرفه‌ای) =====
    display_name = user.full_name or user.first_name or "کاربر"
    name_y = avatar_y + avatar_size + 70
    
    # سایه
    shadow_offset = 6
    for offset in range(shadow_offset, 0, -1):
        alpha = int(50 * (offset / shadow_offset))
        draw.text(
            (CARD_WIDTH // 2 + offset, name_y + offset),
            display_name,
            font=get_font("Kalameh-Bold.ttf", 68),
            fill=(0, 0, 0, alpha),
            anchor="mt",
        )
    
    # متن اصلی (با افکت نوری)
    draw.text(
        (CARD_WIDTH // 2, name_y),
        display_name,
        font=get_font("Kalameh-Bold.ttf", 68),
        fill=COLORS["white"],
        anchor="mt",
    )
    
    # ===== ۹. کارت‌های اطلاعات (Glassmorphism) =====
    # سه کارت مجزا برای اطلاعات اصلی
    info_cards = []
    
    # کارت اول: شماره عضویت
    card1 = create_rounded_rect(
        (340, 90),
        radius=16,
        color=COLORS["glass_bg"],
        outline_color=COLORS["glass_border"],
        outline_width=1
    )
    card1 = apply_glow_effect(card1, radius=8, intensity=0.3)
    
    # کارت دوم: مقطع تحصیلی
    card2 = create_rounded_rect(
        (340, 90),
        radius=16,
        color=COLORS["glass_bg"],
        outline_color=COLORS["glass_border"],
        outline_width=1
    )
    card2 = apply_glow_effect(card2, radius=8, intensity=0.3)
    
    # کارت سوم: علایق
    card3 = create_rounded_rect(
        (720, 90),
        radius=16,
        color=COLORS["glass_bg"],
        outline_color=COLORS["glass_border"],
        outline_width=1
    )
    card3 = apply_glow_effect(card3, radius=8, intensity=0.3)
    
    # محاسبه موقعیت کارت‌ها
    info_y = name_y + 100
    card_spacing = 24
    card1_x = 60
    card2_x = card1_x + 340 + card_spacing
    card3_x = card2_x + 340 + card_spacing
    
    # قرار دادن کارت‌ها روی بوم
    card.paste(card1, (card1_x, info_y), card1)
    card.paste(card2, (card2_x, info_y), card2)
    card.paste(card3, (card3_x, info_y), card3)
    draw = ImageDraw.Draw(card)
    
    # متن‌های داخل کارت‌ها
    # کارت اول: شماره عضویت
    draw.text(
        (card1_x + 170, info_y + 30),
        "شماره عضویت",
        font=get_font("Kalameh-Regular.ttf", 24),
        fill=COLORS["text_muted"],
        anchor="mt",
    )
    draw.text(
        (card1_x + 170, info_y + 65),
        to_persian_num(member_count),
        font=get_font("Kalameh-Bold.ttf", 38),
        fill=COLORS["gold_light"],
        anchor="mt",
    )
    
    # کارت دوم: مقطع تحصیلی
    edu_label = data.get("education_label", "کارشناسی")
    draw.text(
        (card2_x + 170, info_y + 30),
        "مقطع تحصیلی",
        font=get_font("Kalameh-Regular.ttf", 24),
        fill=COLORS["text_muted"],
        anchor="mt",
    )
    draw.text(
        (card2_x + 170, info_y + 65),
        edu_label,
        font=get_font("Kalameh-Bold.ttf", 32),
        fill=COLORS["white"],
        anchor="mt",
    )
    
    # کارت سوم: علایق
    interests_raw = data.get("interests", [])
    interests = list(interests_raw) if not isinstance(interests_raw, list) else interests_raw
    interests_text = "، ".join(interests[:2])
    if len(interests) > 2:
        interests_text += "، ..."
    
    draw.text(
        (card3_x + 360, info_y + 30),
        "علایق",
        font=get_font("Kalameh-Regular.ttf", 24),
        fill=COLORS["text_muted"],
        anchor="mt",
    )
    draw.text(
        (card3_x + 360, info_y + 65),
        interests_text or "ثبت نشده",
        font=get_font("Kalameh-Regular.ttf", 28),
        fill=COLORS["cream"],
        anchor="mt",
    )
    
    # ===== ۱۰. تاریخ عضویت =====
    date_y = info_y + 90 + 40
    draw.text(
        (CARD_WIDTH // 2, date_y),
        f"🗓 تاریخ عضویت: {jalali_now}",
        font=get_font("Kalameh-Regular.ttf", 28),
        fill=COLORS["text_muted"],
        anchor="mt",
    )
    
    # ===== ۱۱. خط جداکننده =====
    separator_y = date_y + 70
    draw.line(
        [(120, separator_y), (CARD_WIDTH - 120, separator_y)],
        fill=COLORS["gold"] + (100,),
        width=2,
    )
    
    # ===== ۱۲. QR Code با طراحی خاص =====
    if qr_data:
        qr_size = 220
        qr_x = CARD_WIDTH // 2 - qr_size // 2
        qr_y = separator_y + 50
        
        # تولید QR با رنگ‌های برند
        qr = qrcode.QRCode(
            version=2,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#d4af37", back_color="white").convert('RGBA')
        qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)
        
        # پس‌زمینه QR با طراحی قاب
        container_size = qr_size + 80
        container = Image.new('RGBA', (container_size, container_size), (0, 0, 0, 0))
        container_draw = ImageDraw.Draw(container)
        
        # قاب با گوشه‌های گرد و حاشیه طلایی
        container_draw.rounded_rectangle(
            (0, 0, container_size, container_size),
            radius=20,
            fill=(255, 255, 255, 25),
            outline=COLORS["gold"] + (120,),
            width=2,
        )
        
        # گوشه‌های تزیینی
        corner_size = 30
        for cx, cy in [(0, 0), (container_size, 0), (0, container_size), (container_size, container_size)]:
            sign_x = 1 if cx == 0 else -1
            sign_y = 1 if cy == 0 else -1
            container_draw.line(
                [(cx + sign_x * 15, cy + sign_y * 0),
                 (cx + sign_x * 15, cy + sign_y * corner_size),
                 (cx + sign_x * corner_size, cy + sign_y * corner_size)],
                fill=COLORS["gold"] + (180,),
                width=3
            )
        
        # قرار دادن QR در مرکز
        qr_offset = (container_size - qr_size) // 2
        container.paste(qr_img, (qr_offset, qr_offset), qr_img)
        
        # قرار دادن محفظه روی کارت
        container_x = qr_x - 40
        container_y = qr_y - 40
        card.paste(container, (container_x, container_y), container)
        
        # متن زیر QR
        draw.text(
            (CARD_WIDTH // 2, qr_y + container_size + 35),
            "اسکن کنید و به جمع معماران بپیوندید",
            font=get_font("Kalameh-Regular.ttf", 28),
            fill=COLORS["gold_light"],
            anchor="mt",
        )
    
    # ===== ۱۳. فوتر با امضای برند =====
    footer_y = CARD_HEIGHT - 70
    # خط تزئینی پایین
    draw.line(
        [(CARD_WIDTH//2 - 100, footer_y - 15), (CARD_WIDTH//2 + 100, footer_y - 15)],
        fill=COLORS["gold"] + (60,),
        width=1,
    )
    
    draw.text(
        (CARD_WIDTH // 2, footer_y),
        "— تیم رواق 🏛",
        font=get_font("Kalameh-Regular.ttf", 30),
        fill=COLORS["gold_light"],
        anchor="mt",
    )
    
    # ===== ۱۴. المان‌های تزئینی نهایی =====
    # چهار گوشه برند
    corner_style = 30
    for x, y in [(40, 40), (CARD_WIDTH-40, 40), (40, CARD_HEIGHT-40), (CARD_WIDTH-40, CARD_HEIGHT-40)]:
        sign_x = 1 if x < CARD_WIDTH//2 else -1
        sign_y = 1 if y < CARD_HEIGHT//2 else -1
        draw.line(
            [(x + sign_x * 10, y + sign_y * 0),
             (x + sign_x * 10, y + sign_y * corner_style),
             (x + sign_x * corner_style, y + sign_y * corner_style)],
            fill=COLORS["gold"] + (200,),
            width=3
        )
    
    # ===== ذخیره و بازگشت =====
    output = io.BytesIO()
    card.save(output, format='PNG', quality=95, optimize=True)
    output.seek(0)
    
    return BufferedInputFile(output.read(), filename="membership_card.png")