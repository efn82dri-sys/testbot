# -*- coding: utf-8 -*-
"""
ماژول تولید کارت عضویت تصویری «رواق» - نسخه معماری مدرن
طراحی مینیمال با الهام از معماری معاصر و برند رواق
"""

import io
import logging
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
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
    تولید کارت عضویت با طراحی معماری مدرن و مینیمال
    """
    
    CARD_WIDTH = 1080
    CARD_HEIGHT = 1920
    
    # پالت رنگی مینیمال برند
    COLORS = {
        "bg": (10, 14, 23),           # #0a0e17 - مشکی مایل به آبی
        "bg_light": (18, 26, 40),     # #121a28
        "gold": (212, 175, 55),       # #d4af37
        "gold_light": (235, 210, 130),# #ebd282
        "gold_glow": (212, 175, 55, 30),
        "white": (255, 255, 255),
        "white_dim": (200, 200, 200),
        "gray": (130, 140, 160),
        "gray_light": (180, 190, 210),
        "line": (212, 175, 55, 40),
        "qr_bg": (255, 255, 255, 20),
    }
    
    # ===== ۱. بوم اصلی با گرادیان ملایم =====
    card = Image.new('RGBA', (CARD_WIDTH, CARD_HEIGHT), COLORS["bg"])
    draw = ImageDraw.Draw(card)
    
    # گرادیان عمودی ملایم از بالا به پایین
    for y in range(CARD_HEIGHT):
        ratio = y / CARD_HEIGHT
        # ترکیب دو رنگ با ضریب سینوسی نرم
        factor = (1 - math.cos(ratio * math.pi)) / 2
        r = int(COLORS["bg"][0] + (COLORS["bg_light"][0] - COLORS["bg"][0]) * factor)
        g = int(COLORS["bg"][1] + (COLORS["bg_light"][1] - COLORS["bg"][1]) * factor)
        b = int(COLORS["bg"][2] + (COLORS["bg_light"][2] - COLORS["bg"][2]) * factor)
        draw.line((0, y, CARD_WIDTH, y), fill=(r, g, b))
    
    # ===== ۲. خطوط معماری (مدرن و مینیمال) =====
    # خطوط افقی نازک در یک‌چهارم بالایی
    for y in [80, 90, 100]:
        draw.line((40, y, CARD_WIDTH - 40, y), fill=COLORS["line"], width=1)
    
    # خط عمودی باریک در سمت چپ
    draw.line((45, 110, 45, CARD_HEIGHT - 110), fill=COLORS["line"], width=1)
    
    # ===== ۳. لوگو و عنوان =====
    logo = load_asset("logo.png")
    if logo:
        logo = logo.resize((80, 80))
        card.paste(logo, (70, 45), logo)
    else:
        draw.text((85, 55), "🏛", font=get_font("Kalameh-Bold.ttf", 48), fill=COLORS["gold"])
    
    # عنوان «رواق»
    draw.text(
        (180, 52),
        "رواق",
        font=get_font("Kalameh-Bold.ttf", 52),
        fill=COLORS["gold_light"],
    )
    
    # زیرنویس
    draw.text(
        (180, 112),
        "مرجع فایل‌های معماری و عمران",
        font=get_font("Kalameh-Regular.ttf", 24),
        fill=COLORS["gray_light"],
    )
    
    # ===== ۴. عکس پروفایل با طراحی مینیمال =====
    avatar_size = 240
    avatar_x = CARD_WIDTH // 2 - avatar_size // 2
    avatar_y = 200
    
    if profile_image:
        profile = profile_image.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
        mask = Image.new('L', (avatar_size, avatar_size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.ellipse((0, 0, avatar_size, avatar_size), fill=255)
        profile.putalpha(mask)
        
        # حاشیه طلایی باریک
        border_size = avatar_size + 12
        border_mask = Image.new('L', (border_size, border_size), 0)
        border_draw = ImageDraw.Draw(border_mask)
        border_draw.ellipse((0, 0, border_size, border_size), fill=255)
        border = Image.new('RGBA', (border_size, border_size), COLORS["gold"])
        border.putalpha(border_mask)
        
        border_x = avatar_x - 6
        border_y = avatar_y - 6
        card.paste(border, (border_x, border_y), border)
        card.paste(profile, (avatar_x, avatar_y), profile)
    else:
        draw.ellipse(
            [(avatar_x, avatar_y), (avatar_x + avatar_size, avatar_y + avatar_size)],
            fill=(30, 40, 60),
            outline=COLORS["gold"],
            width=3,
        )
        draw.text(
            (CARD_WIDTH // 2, avatar_y + avatar_size // 2),
            "👤",
            font=get_font("Kalameh-Bold.ttf", 80),
            fill=COLORS["gold_light"],
            anchor="mm",
        )
    
    # ===== ۵. نام کاربر =====
    display_name = user.full_name or user.first_name or "کاربر"
    name_y = avatar_y + avatar_size + 50
    
    # سایه نرم
    draw.text(
        (CARD_WIDTH // 2 + 2, name_y + 3),
        display_name,
        font=get_font("Kalameh-Bold.ttf", 62),
        fill=(0, 0, 0, 60),
        anchor="mt",
    )
    
    draw.text(
        (CARD_WIDTH // 2, name_y),
        display_name,
        font=get_font("Kalameh-Bold.ttf", 62),
        fill=COLORS["white"],
        anchor="mt",
    )
    
    # ===== ۶. خط جداکننده =====
    sep_y = name_y + 80
    draw.line(
        [(CARD_WIDTH//2 - 120, sep_y), (CARD_WIDTH//2 + 120, sep_y)],
        fill=COLORS["gold"],
        width=2,
    )
    
    # ===== ۷. اطلاعات (لیست عمودی مرتب) =====
    info_y = sep_y + 50
    info_x = CARD_WIDTH // 2 - 300
    
    info_items = [
        ("شماره عضویت", to_persian_num(member_count)),
        ("مقطع تحصیلی", data.get("education_label", "کارشناسی")),
        ("تاریخ عضویت", jalali_now),
    ]
    
    for i, (label, value) in enumerate(info_items):
        y_pos = info_y + i * 70
        
        # لیبل (سفید کم‌رنگ)
        draw.text(
            (info_x, y_pos),
            label,
            font=get_font("Kalameh-Regular.ttf", 28),
            fill=COLORS["gray"],
        )
        
        # مقدار (طلایی یا سفید)
        if "شماره" in label:
            color = COLORS["gold_light"]
        else:
            color = COLORS["white"]
        
        draw.text(
            (info_x + 340, y_pos),
            value,
            font=get_font("Kalameh-Regular.ttf", 28),
            fill=color,
            anchor="ra",
        )
        
        # خط زیر هر آیتم
        if i < len(info_items) - 1:
            draw.line(
                [(info_x, y_pos + 45), (info_x + 340, y_pos + 45)],
                fill=COLORS["line"],
                width=1,
            )
    
    # ===== ۸. QR Code =====
    if qr_data:
        qr_size = 200
        qr_x = CARD_WIDTH // 2 - qr_size // 2
        qr_y = info_y + 3 * 70 + 60
        
        qr = qrcode.QRCode(
            version=2,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=9,
            border=1,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#d4af37", back_color="white").convert('RGBA')
        qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)
        
        # زمینه شفاف برای QR
        container = Image.new('RGBA', (qr_size + 50, qr_size + 50), (0, 0, 0, 0))
        container_draw = ImageDraw.Draw(container)
        container_draw.rounded_rectangle(
            (0, 0, qr_size + 50, qr_size + 50),
            radius=12,
            fill=COLORS["qr_bg"],
            outline=COLORS["gold"] + (60,),
            width=1,
        )
        
        # گوشه‌های تزئینی
        corner_len = 18
        for cx, cy in [(25, 25), (qr_size + 25, 25), (25, qr_size + 25), (qr_size + 25, qr_size + 25)]:
            sign_x = -1 if cx > (qr_size + 50)//2 else 1
            sign_y = -1 if cy > (qr_size + 50)//2 else 1
            container_draw.line(
                [(cx + sign_x * 8, cy + sign_y * 0),
                 (cx + sign_x * 8, cy + sign_y * corner_len),
                 (cx + sign_x * corner_len, cy + sign_y * corner_len)],
                fill=COLORS["gold"] + (150,),
                width=2
            )
        
        # قرار دادن QR
        qr_offset = 25
        container.paste(qr_img, (qr_offset, qr_offset), qr_img)
        
        container_x = qr_x - 25
        container_y = qr_y - 25
        card.paste(container, (container_x, container_y), container)
        
        # متن زیر QR
        draw.text(
            (CARD_WIDTH // 2, qr_y + qr_size + 65),
            "اسکن کنید و به جمع معماران بپیوندید",
            font=get_font("Kalameh-Regular.ttf", 24),
            fill=COLORS["gray_light"],
            anchor="mt",
        )
    
    # ===== ۹. فوتر =====
    footer_y = CARD_HEIGHT - 60
    
    # خط تزئینی
    draw.line(
        [(CARD_WIDTH//2 - 80, footer_y - 10), (CARD_WIDTH//2 + 80, footer_y - 10)],
        fill=COLORS["gold"] + (50,),
        width=1,
    )
    
    draw.text(
        (CARD_WIDTH // 2, footer_y),
        "— تیم رواق 🏛",
        font=get_font("Kalameh-Regular.ttf", 26),
        fill=COLORS["gray"],
        anchor="mt",
    )
    
    # ===== ذخیره و بازگشت =====
    output = io.BytesIO()
    card.save(output, format='PNG', quality=95, optimize=True)
    output.seek(0)
    
    return BufferedInputFile(output.read(), filename="membership_card.png")