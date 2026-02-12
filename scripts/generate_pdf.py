#!/usr/bin/env python3
"""
PDF Generator - reportlab 기반 와인 테이스팅 노트
generate_ppt.py와 동일한 디자인 시스템 공유 (좌표, 색상, 폰트, 레이아웃)

Usage: python generate_pdf.py <input.json> <output.pdf>
입력 JSON 형식은 generate_ppt.py와 동일
"""

import sys
import os
import json
import subprocess

_PKG_DIR = '/tmp/python_packages'

def _ensure_packages():
    try:
        import reportlab  # noqa: F401
        return
    except ImportError:
        pass
    os.makedirs(_PKG_DIR, exist_ok=True)
    sys.path.insert(0, _PKG_DIR)
    subprocess.check_call([
        sys.executable, '-m', 'pip', 'install',
        'reportlab', 'Pillow',
        '-t', _PKG_DIR, '--quiet', '--disable-pip-version-check'
    ], stdout=subprocess.DEVNULL)

_ensure_packages()

import re
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, Color
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from io import BytesIO

# ═══════════════════════════════════════════════════
# 디자인 시스템 (generate_ppt.py와 동일)
# ═══════════════════════════════════════════════════

COLORS = {
    'BG_CREAM':       '#FAF7F2',
    'BG_BOTTLE_AREA': '#F5F0EA',
    'BURGUNDY':       '#722F37',
    'BURGUNDY_DARK':  '#5A252C',
    'BURGUNDY_LIGHT': '#F2E8EA',
    'GOLD':           '#B8976A',
    'GOLD_LIGHT':     '#D4C4A8',
    'TEXT_PRIMARY':   '#2C2C2C',
    'TEXT_SECONDARY': '#5A5A5A',
    'TEXT_MUTED':     '#8A8A8A',
    'WHITE':          '#FFFFFF',
    'CARD_BORDER':    '#E0D5C8',
    'DIVIDER':        '#D4C4A8',
    'DIVIDER_LIGHT':  '#E8DDD0',
}

# 슬라이드 크기 (인치)
SW = 7.5
SH = 10.0

# 포인트 변환 (1인치 = 72pt)
PW = SW * 72  # 540pt
PH = SH * 72  # 720pt

# 폰트 경로
FONT_REGULAR = 'C:\\Windows\\Fonts\\malgun.ttf'
FONT_BOLD = 'C:\\Windows\\Fonts\\malgunbd.ttf'
FONT_GEORGIA = 'C:\\Windows\\Fonts\\georgia.ttf'
FONT_GEORGIA_I = 'C:\\Windows\\Fonts\\georgiai.ttf'

_fonts_registered = False

def register_fonts():
    global _fonts_registered
    if _fonts_registered:
        return
    _fonts_registered = True
    try:
        if os.path.exists(FONT_REGULAR):
            pdfmetrics.registerFont(TTFont('MalgunGothic', FONT_REGULAR))
        if os.path.exists(FONT_BOLD):
            pdfmetrics.registerFont(TTFont('MalgunGothicBold', FONT_BOLD))
        if os.path.exists(FONT_GEORGIA):
            pdfmetrics.registerFont(TTFont('Georgia', FONT_GEORGIA))
        if os.path.exists(FONT_GEORGIA_I):
            pdfmetrics.registerFont(TTFont('GeorgiaItalic', FONT_GEORGIA_I))
    except Exception as e:
        print(f"Warning: Font registration failed: {e}", file=sys.stderr)


def font_name(bold=False, georgia=False):
    if georgia:
        if os.path.exists(FONT_GEORGIA_I):
            return 'GeorgiaItalic'
        if os.path.exists(FONT_GEORGIA):
            return 'Georgia'
        return 'Times-Italic'
    if bold and os.path.exists(FONT_BOLD):
        return 'MalgunGothicBold'
    if os.path.exists(FONT_REGULAR):
        return 'MalgunGothic'
    return 'Helvetica'


def hex_color(key):
    h = COLORS[key]
    return HexColor(h)


# ═══════════════════════════════════════════════════
# reportlab 좌표계: 좌하단 원점 → PPT(좌상단)를 변환
# y_pdf = PH - y_ppt_inches * 72
# ═══════════════════════════════════════════════════

def Y(y_inch):
    """PPT 좌표(상단 기준 인치)를 PDF 좌표(하단 기준 pt)로 변환"""
    return PH - y_inch * 72


def X(x_inch):
    """인치 → pt"""
    return x_inch * 72


def W(w_inch):
    return w_inch * 72


def H(h_inch):
    return h_inch * 72


# ═══════════════════════════════════════════════════
# 이미지 여백 크롭 (generate_ppt.py와 동일)
# ═══════════════════════════════════════════════════

def crop_whitespace(img):
    from PIL import ImageOps

    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    w, h = img.size
    alpha = img.split()[3]
    amin, _ = alpha.getextrema()

    if amin < 128:
        bbox = alpha.getbbox()
        if bbox:
            cw, ch = bbox[2] - bbox[0], bbox[3] - bbox[1]
            if cw < w * 0.95 or ch < h * 0.95:
                pad = max(3, min(w, h) // 80)
                bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                        min(w, bbox[2] + pad), min(h, bbox[3] + pad))
                return img.crop(bbox)
        return img

    gray = img.convert('L')
    inv = ImageOps.invert(gray)
    bw = inv.point(lambda x: 255 if x > 25 else 0)
    bbox = bw.getbbox()
    if bbox:
        cw, ch = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if cw < w * 0.95 or ch < h * 0.95:
            pad = max(3, min(w, h) // 80)
            bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                    min(w, bbox[2] + pad), min(h, bbox[3] + pad))
            return img.crop(bbox)

    return img


# ═══════════════════════════════════════════════════
# 헬퍼 함수
# ═══════════════════════════════════════════════════

def draw_rect(c, x, y, w, h, fill_color=None, stroke_color=None,
              stroke_width=0, alpha=1.0):
    """사각형 (PPT 좌표계: x,y = 좌상단 인치)"""
    c.saveState()
    if alpha < 1.0:
        c.setFillAlpha(alpha)
    if fill_color:
        c.setFillColor(hex_color(fill_color) if isinstance(fill_color, str) else fill_color)
    if stroke_color:
        c.setStrokeColor(hex_color(stroke_color) if isinstance(stroke_color, str) else stroke_color)
        c.setLineWidth(stroke_width)
    else:
        c.setStrokeAlpha(0)

    # PDF 좌표: 좌하단
    px = X(x)
    py = Y(y + h)  # 하단 y
    pw = W(w)
    ph = H(h)

    if fill_color:
        c.rect(px, py, pw, ph, fill=1, stroke=1 if stroke_color else 0)
    elif stroke_color:
        c.rect(px, py, pw, ph, fill=0, stroke=1)

    c.restoreState()


def draw_rounded_rect(c, x, y, w, h, radius=5, fill_color=None,
                      stroke_color=None, stroke_width=0.5, alpha=1.0):
    """둥근 사각형"""
    c.saveState()
    if alpha < 1.0:
        c.setFillAlpha(alpha)
    if fill_color:
        c.setFillColor(hex_color(fill_color) if isinstance(fill_color, str) else fill_color)
    if stroke_color:
        c.setStrokeColor(hex_color(stroke_color) if isinstance(stroke_color, str) else stroke_color)
        c.setLineWidth(stroke_width)
    else:
        c.setStrokeAlpha(0)

    px = X(x)
    py = Y(y + h)
    pw = W(w)
    ph = H(h)

    c.roundRect(px, py, pw, ph, radius,
                fill=1 if fill_color else 0,
                stroke=1 if stroke_color else 0)
    c.restoreState()


def draw_hline(c, x, y, w, color='DIVIDER', width=0.75):
    """수평선 (PPT 좌표)"""
    c.saveState()
    c.setStrokeColor(hex_color(color))
    c.setLineWidth(width)
    c.line(X(x), Y(y), X(x + w), Y(y))
    c.restoreState()


def draw_text(c, text, x, y, font_size=9, color='TEXT_PRIMARY',
              bold=False, italic=False, max_width=None, georgia=False):
    """단일 행 텍스트"""
    c.saveState()
    c.setFillColor(hex_color(color))
    fn = font_name(bold=bold, georgia=georgia)
    c.setFont(fn, font_size)
    # PPT y는 텍스트 상단, PDF는 베이스라인
    # 베이스라인 ≈ 상단 + 폰트크기
    py = Y(y) - font_size
    if max_width:
        # 길면 잘라내기
        while c.stringWidth(text, fn, font_size) > W(max_width) and len(text) > 3:
            text = text[:-1]
        if len(text) < len(text):
            text = text + '...'
    c.drawString(X(x), py, text)
    c.restoreState()


def draw_text_wrapped(c, text, x, y, width, height, font_size=9,
                      color='TEXT_PRIMARY', bold=False, line_spacing=None,
                      georgia=False):
    """여러 줄 텍스트 (자동 줄바꿈)"""
    if not text:
        return

    c.saveState()
    c.setFillColor(hex_color(color))
    fn = font_name(bold=bold, georgia=georgia)
    c.setFont(fn, font_size)

    ls = line_spacing or (font_size * 1.45)
    max_w = W(width)
    py = Y(y) - font_size  # 첫 행 베이스라인
    bottom = Y(y + height)

    lines = text.split('\n')
    for line in lines:
        if py < bottom:
            break
        # 워드랩
        words = line.split(' ') if ' ' in line else list(line)
        if ' ' in line:
            current = ''
            for word in words:
                test = current + (' ' if current else '') + word
                if c.stringWidth(test, fn, font_size) <= max_w:
                    current = test
                else:
                    if current:
                        c.drawString(X(x), py, current)
                        py -= ls
                        if py < bottom:
                            break
                    current = word
            if current and py >= bottom:
                c.drawString(X(x), py, current)
                py -= ls
        else:
            # 한글 등 공백 없는 텍스트: 글자 단위 줄바꿈
            current = ''
            for ch in line:
                test = current + ch
                if c.stringWidth(test, fn, font_size) <= max_w:
                    current = test
                else:
                    if current:
                        c.drawString(X(x), py, current)
                        py -= ls
                        if py < bottom:
                            break
                    current = ch
            if current and py >= bottom:
                c.drawString(X(x), py, current)
                py -= ls

    c.restoreState()


def draw_label_badge(c, text, x, y, w, h=0.22):
    """버건디 라벨 뱃지"""
    draw_rounded_rect(c, x, y, w, h, radius=4,
                      fill_color='BURGUNDY')
    # 텍스트 중앙 배치
    c.saveState()
    c.setFillColor(white)
    fn = font_name(True)
    fs = 8.5
    c.setFont(fn, fs)

    tw = c.stringWidth(text, fn, fs)
    tx = X(x) + (W(w) - tw) / 2
    ty = Y(y + h / 2) - fs * 0.35

    c.drawString(tx, ty, text)
    c.restoreState()


def draw_image_safe(c, path, x, y, w, h):
    """이미지 안전 삽입 (PPT 좌표)"""
    if not path or not os.path.exists(path):
        return
    try:
        img = ImageReader(path)
        # PDF: drawImage는 좌하단 기준
        c.drawImage(img, X(x), Y(y + h), W(w), H(h),
                    preserveAspectRatio=True, mask='auto')
    except Exception as e:
        print(f"Warning: image failed: {e}", file=sys.stderr)


# ═══════════════════════════════════════════════════
# 페이지 빌더 (generate_ppt.py와 동일한 레이아웃)
# ═══════════════════════════════════════════════════

def add_tasting_note_page(c, data, logo_path=None, icon_path=None):
    """단일 와인 테이스팅 노트 페이지"""

    # ════════════════════════════════════════════
    # 1. 배경: 흰색
    # ════════════════════════════════════════════
    c.saveState()
    c.setFillColor(white)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)
    c.restoreState()

    # 2. 좌측 병 영역 배경 패널
    draw_rect(c, 0, 0.90, 2.10, 8.10,
              fill_color='BG_BOTTLE_AREA', alpha=0.6)

    # ════════════════════════════════════════════
    # 3. HEADER - Logo
    # ════════════════════════════════════════════
    if logo_path and os.path.exists(logo_path):
        try:
            img = ImageReader(logo_path)
            c.drawImage(img, X(0.20), Y(0.20 + 0.57), W(1.49), H(0.57),
                        preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    # 와이너리 태그라인
    winery_desc = data.get('wineryDescription', '')
    if winery_desc:
        tagline = winery_desc.split('.')[0].strip()
        if not tagline:
            tagline = winery_desc.split('\u3002')[0].strip()
        if tagline:
            draw_text(c, tagline, 1.76, 0.24, font_size=9,
                      color='TEXT_MUTED', italic=True, max_width=5.20,
                      georgia=True)

    # 4-5. 헤더 구분선 (버건디 + 골드 이중선)
    draw_hline(c, 0.20, 0.84, 7.10, 'BURGUNDY', 1.0)
    draw_hline(c, 0.20, 0.87, 7.10, 'GOLD_LIGHT', 0.75)

    # ════════════════════════════════════════════
    # 6. 와인명 카드 배경
    # ════════════════════════════════════════════
    draw_rounded_rect(c, 2.05, 0.97, 5.20, 0.76,
                      fill_color='BURGUNDY_LIGHT',
                      stroke_color='CARD_BORDER',
                      stroke_width=0.5, alpha=0.8)

    # 7. 와인명
    name_kr = data.get('nameKr', '')
    name_en = data.get('nameEn', '')
    name_kr_clean = re.sub(r'^[A-Za-z]{2}\s+', '', name_kr)

    draw_text(c, name_kr_clean, 2.20, 1.04, font_size=14.5,
              color='BURGUNDY_DARK', bold=True, max_width=4.90)
    if name_en:
        draw_text(c, name_en, 2.20, 1.34, font_size=10.5,
                  color='TEXT_SECONDARY', max_width=4.90, georgia=True)

    # 8. 와인명 하단 구분선
    draw_hline(c, 2.20, 1.82, 4.90, 'DIVIDER', 0.75)

    # ════════════════════════════════════════════
    # 9-10. 지역
    # ════════════════════════════════════════════
    draw_label_badge(c, '지역', 2.12, 1.97, 0.55)

    region = data.get('region', '')
    country_en = data.get('countryEn', '') or data.get('country', '')
    region_text = f"{country_en}, {region}" if region else (country_en or '-')
    draw_text(c, region_text, 2.75, 2.00, font_size=9.5,
              color='TEXT_PRIMARY', max_width=4.40)

    draw_hline(c, 2.20, 2.35, 4.90, 'DIVIDER_LIGHT', 0.5)

    # 11-12. 품종
    draw_label_badge(c, '품종', 2.12, 2.42, 0.55)
    draw_text_wrapped(c, data.get('grapeVarieties', '') or '-',
                      2.75, 2.45, 4.40, 0.40, font_size=9.5)

    # ════════════════════════════════════════════
    # 13-14. 빈티지
    # ════════════════════════════════════════════
    draw_label_badge(c, '빈티지', 2.12, 3.02, 0.65)

    vintage = data.get('vintage', '') or '-'
    draw_text(c, vintage, 2.85, 3.03, font_size=13,
              color='BURGUNDY', bold=True)

    vintage_note = data.get('vintageNote', '')
    if vintage_note:
        draw_text_wrapped(c, vintage_note, 3.65, 3.06, 3.50, 0.40,
                          font_size=8, color='TEXT_SECONDARY')

    # ════════════════════════════════════════════
    # 15-16. 양조
    # ════════════════════════════════════════════
    draw_label_badge(c, '양조', 2.12, 3.62, 0.55)

    winemaking_text = data.get('winemaking', '') or '-'
    alcohol = data.get('alcoholPercentage', '')
    if alcohol:
        winemaking_text += f"\n알코올: {alcohol}"
    draw_text_wrapped(c, winemaking_text, 2.15, 3.93, 5.00, 1.23,
                      font_size=9, line_spacing=12)

    # ════════════════════════════════════════════
    # 17-18. 테이스팅 노트
    # ════════════════════════════════════════════
    draw_rounded_rect(c, 2.05, 5.30, 5.20, 2.72,
                      fill_color='BURGUNDY_LIGHT',
                      stroke_color='CARD_BORDER',
                      stroke_width=0.5, alpha=0.7)

    draw_label_badge(c, 'TASTING NOTE', 2.12, 5.35, 1.32, h=0.22)

    tasting_items = [
        ('Color', data.get('colorNote', '')),
        ('Nose', data.get('noseNote', '')),
        ('Palate', data.get('palateNote', '')),
        ('Potential', data.get('agingPotential', '')),
    ]

    ty = 5.65
    for label, value in tasting_items:
        if not value:
            continue

        # 라벨 (Georgia Italic, burgundy)
        draw_text(c, label, 2.15, ty, font_size=8.5,
                  color='BURGUNDY', georgia=True)

        # 값
        val_lines = max(1, len(value) // 55 + 1)
        val_h = min(val_lines * 0.18, 0.55)
        draw_text_wrapped(c, value, 2.15, ty + 0.17, 5.00, val_h,
                          font_size=9)

        ty += 0.17 + val_h + 0.08

    if all(not v for _, v in tasting_items):
        draw_text(c, '-', 2.15, 5.65, font_size=9, color='TEXT_MUTED')

    # ════════════════════════════════════════════
    # 19. 푸드 페어링
    # ════════════════════════════════════════════
    draw_label_badge(c, '푸드 페어링', 2.12, 8.18, 0.95)
    draw_text_wrapped(c, data.get('foodPairing', '') or '-',
                      2.15, 8.44, 5.00, 0.44, font_size=9, line_spacing=12)

    # ════════════════════════════════════════════
    # 20. 수상내역
    # ════════════════════════════════════════════
    draw_hline(c, 0.15, 9.04, 7.20, 'GOLD_LIGHT', 0.5)

    awards = data.get('awards', '')
    if awards and awards != 'N/A':
        if icon_path and os.path.exists(icon_path):
            try:
                img = ImageReader(icon_path)
                c.drawImage(img, X(0.25), Y(9.08 + 0.28), W(0.22), H(0.28),
                            preserveAspectRatio=True, mask='auto')
            except Exception:
                pass

        # AWARDS 라벨
        draw_text(c, 'AWARDS  ', 0.52, 9.12, font_size=8,
                  color='GOLD', bold=True)

        # 수상 내용
        lbl_w = c.stringWidth('AWARDS  ', font_name(True), 8) / 72
        draw_text_wrapped(c, awards, 0.52 + lbl_w, 9.12, 6.70 - lbl_w, 0.30,
                          font_size=9)

    # ════════════════════════════════════════════
    # 21-23. FOOTER
    # ════════════════════════════════════════════
    draw_hline(c, 0.20, 9.52, 7.10, 'BURGUNDY', 2.0)
    draw_hline(c, 0.20, 9.55, 7.10, 'GOLD_LIGHT', 0.75)

    # Footer 로고
    if logo_path and os.path.exists(logo_path):
        try:
            img = ImageReader(logo_path)
            c.drawImage(img, X(0.09), Y(9.68 + 0.25), W(0.95), H(0.25),
                        preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    # 회사 정보
    c.saveState()
    fn = font_name()
    fs = 7
    c.setFont(fn, fs)
    c.setFillColor(hex_color('TEXT_MUTED'))
    info_text = 'T. 02-786-3136  |  www.cavedevin.co.kr'
    tw = c.stringWidth(info_text, fn, fs)
    c.drawString(X(1.12 + 2.76) - tw, Y(9.73) - fs, info_text)
    c.restoreState()

    # ════════════════════════════════════════════
    # 24. 병 이미지
    # ════════════════════════════════════════════
    bottle_path = data.get('bottleImagePath', '')
    if bottle_path and os.path.exists(bottle_path):
        try:
            from PIL import Image
            img = Image.open(bottle_path)

            if img.mode in ('P', 'PA'):
                img = img.convert('RGBA')
            elif img.mode in ('L', 'RGB'):
                img = img.convert('RGBA')

            img = crop_whitespace(img)

            converted = bottle_path + '_pdf_conv.png'
            img.save(converted, 'PNG')

            area_w = 1.60
            area_h = 5.50
            area_x = 0.25
            area_y = 2.00

            iw, ih = img.size
            img.close()

            ratio = iw / ih
            ar = area_w / area_h

            if ratio > ar:
                fw = area_w
                fh = area_w / ratio
            else:
                fh = area_h
                fw = area_h * ratio

            ox = area_x + (area_w - fw) / 2
            oy = area_y + (area_h - fh) * 0.3

            img_reader = ImageReader(converted)
            c.drawImage(img_reader, X(ox), Y(oy + fh), W(fw), H(fh),
                        preserveAspectRatio=True, mask='auto')

            try:
                os.remove(converted)
            except Exception:
                pass

        except Exception as e:
            print(f"Warning: bottle image failed: {e}", file=sys.stderr)


# ═══════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_pdf.py <input.json> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, 'r', encoding='utf-8') as f:
        payload = json.load(f)

    slides_data = payload.get('slides', [])
    logo_path = payload.get('logoPath', '')
    icon_path = payload.get('iconPath', '')

    if not slides_data:
        print("Error: No slides data", file=sys.stderr)
        sys.exit(1)

    register_fonts()

    c = canvas.Canvas(output_path, pagesize=(PW, PH))
    c.setTitle("Tasting Notes")
    c.setAuthor("까브드뱅 와인 관리 시스템")

    for i, data in enumerate(slides_data):
        if i > 0:
            c.showPage()
        add_tasting_note_page(c, data, logo_path, icon_path)

    c.save()
    print(f"Saved: {output_path} ({len(slides_data)} pages)", file=sys.stderr)
    print("OK", file=sys.stdout)


if __name__ == '__main__':
    main()
