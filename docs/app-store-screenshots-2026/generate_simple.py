#!/usr/bin/env python3
"""Generate the restrained, reference-matched Oval App Store screenshot set."""

from __future__ import annotations

import math
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
CAPTURES = ROOT / "captures"
ITERATION = ROOT / "iteration-v4-simple"
OUTPUT_65 = ITERATION / "apple" / "en-US" / "6.5-inch"
OUTPUT_69 = ITERATION / "apple" / "en-US" / "6.9-inch"

W, H = 1284, 2778
PAPER = (249, 249, 248)
INK = (10, 13, 18)
SUB = (119, 125, 139)
SCARLET = (215, 9, 18)
WHITE = (255, 255, 255)

AVENIR = "/System/Library/Fonts/Avenir Next.ttc"


SLIDES = [
    {
        "file": "01-find-your-people.png",
        "lines": [[("Find Your", "ink")], [("People", "accent")]],
        "subhead": "Discover real plans happening\naround campus",
        "layout": "explore",
    },
    {
        "file": "02-join-the-plan.png",
        "lines": [[("Join the ", "ink"), ("Plan", "accent")]],
        "subhead": "Small groups meeting up, in\nreal life",
        "layout": "pods",
    },
    {
        "file": "03-plan-it-together.png",
        "lines": [[("Plan it", "ink")], [("Together", "accent")]],
        "subhead": "Lock in the details in group chat",
        "layout": "chat",
    },
    {
        "file": "04-every-club-one-place.png",
        "lines": [[("Every Club", "ink")], [("One", "accent"), (" Place", "ink")]],
        "subhead": None,
        "layout": "clubs",
    },
    {
        "file": "05-stay-in-the-loop.png",
        "lines": [[("Stay in the", "ink")], [("Loop", "accent")]],
        "subhead": "Announcements, meetings, and\nclub chat",
        "layout": "club_home",
    },
    {
        "file": "06-rsvp-in-a-tap.png",
        "lines": [[("RSVP in a ", "ink"), ("Tap", "accent")]],
        "subhead": "Never miss a club meeting or\nevent",
        "layout": "meeting",
    },
]


def font(size: int, index: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(AVENIR, size, index=index)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255
    )
    return mask


def fit_line(
    segments: list[tuple[str, str]], start_size: int, max_width: int
) -> tuple[int, list[ImageFont.FreeTypeFont]]:
    size = start_size
    while size >= 70:
        fonts = [font(size, 9 if style == "accent" else 8) for _, style in segments]
        width = sum(f.getlength(text) for (text, _), f in zip(segments, fonts))
        if width <= max_width:
            return size, fonts
        size -= 2
    return size, fonts


def draw_copy(
    canvas: Image.Image,
    lines: list[list[tuple[str, str]]],
    subhead: str | None,
    *,
    x: int,
    y: int,
    max_width: int = 1120,
    align: str = "left",
    headline_size: int = 156,
) -> None:
    draw = ImageDraw.Draw(canvas)
    cursor_y = y
    for segments in lines:
        size, fonts = fit_line(segments, headline_size, max_width)
        widths = [f.getlength(text) for (text, _), f in zip(segments, fonts)]
        line_width = sum(widths)
        cursor_x = x if align == "left" else x + max_width - line_width
        for (text, style), text_font, text_width in zip(segments, fonts, widths):
            color = SCARLET if style == "accent" else INK
            draw.text((round(cursor_x), cursor_y), text, font=text_font, fill=color)
            cursor_x += text_width
        cursor_y += round(size * 1.02)

    if subhead:
        sub_font = font(59, 2)
        line_spacing = 15
        box = draw.multiline_textbbox((0, 0), subhead, font=sub_font, spacing=line_spacing)
        sub_width = box[2] - box[0]
        sub_x = x if align == "left" else x + max_width - sub_width
        draw.multiline_text(
            (round(sub_x), cursor_y + 55),
            subhead,
            font=sub_font,
            fill=SUB,
            spacing=line_spacing,
            align=align,
        )


def screen_with_status(capture_name: str, size: tuple[int, int]) -> Image.Image:
    screen_w, screen_h = size
    source = Image.open(CAPTURES / capture_name).convert("RGB")
    status_h = round(screen_w * 0.09)
    content_h = screen_h - status_h
    source = source.resize((screen_w, content_h), Image.Resampling.LANCZOS)

    screen = Image.new("RGB", (screen_w, screen_h), WHITE)
    screen.paste(source, (0, status_h))
    draw = ImageDraw.Draw(screen)

    status_font = font(max(20, round(screen_w * 0.036)), 0)
    draw.text((round(screen_w * 0.065), round(status_h * 0.30)), "10:19", font=status_font, fill=INK)

    base_y = round(status_h * 0.70)
    bar_w = max(4, round(screen_w * 0.0065))
    gap = max(4, round(screen_w * 0.0055))

    # Cellular bars: four evenly spaced rounded columns with a clean rise.
    signal_x = screen_w - round(screen_w * 0.205)
    heights = [round(status_h * value) for value in (0.19, 0.29, 0.39, 0.50)]
    for i, height in enumerate(heights):
        x = signal_x + i * (bar_w + gap)
        draw.rounded_rectangle(
            (x, base_y - height, x + bar_w, base_y),
            radius=max(2, bar_w // 2),
            fill=INK,
        )

    # Wi-Fi: two true concentric arcs with rounded ends plus a centered dot.
    wifi_x = screen_w - round(screen_w * 0.123)
    wifi_base = base_y + 1
    arc_width = max(4, round(screen_w * 0.0055))
    for radius in (round(screen_w * 0.029), round(screen_w * 0.018)):
        points = []
        for degree in range(225, 316, 5):
            radians = math.radians(degree)
            points.append(
                (
                    round(wifi_x + radius * math.cos(radians)),
                    round(wifi_base + radius * math.sin(radians)),
                )
            )
        draw.line(points, fill=INK, width=arc_width, joint="curve")
        cap = arc_width // 2
        for px, py in (points[0], points[-1]):
            draw.ellipse((px - cap, py - cap, px + cap, py + cap), fill=INK)
    dot_r = max(3, round(screen_w * 0.0045))
    draw.ellipse(
        (wifi_x - dot_r, wifi_base - dot_r, wifi_x + dot_r, wifi_base + dot_r),
        fill=INK,
    )

    # Battery: the compact filled percentage capsule used in the references.
    battery_w = round(screen_w * 0.061)
    battery_h = round(status_h * 0.43)
    battery_x = screen_w - round(screen_w * 0.081)
    battery_y = base_y - battery_h
    draw.rounded_rectangle(
        (battery_x, battery_y, battery_x + battery_w, battery_y + battery_h),
        radius=max(5, battery_h // 4),
        fill=INK,
    )
    draw.rounded_rectangle(
        (
            battery_x + battery_w + 2,
            battery_y + round(battery_h * 0.29),
            battery_x + battery_w + 6,
            battery_y + round(battery_h * 0.71),
        ),
        radius=2,
        fill=INK,
    )
    battery_font = font(max(14, round(battery_h * 0.62)), 0)
    draw.text(
        (battery_x + battery_w / 2, battery_y + battery_h / 2 - 1),
        "73",
        font=battery_font,
        fill=WHITE,
        anchor="mm",
    )
    return screen.convert("RGBA")


def build_phone(capture_name: str, outer_w: int, opacity: float = 1.0) -> Image.Image:
    border = max(15, round(outer_w * 0.022))
    screen_w = outer_w - border * 2
    screen_h = round(screen_w * 844 / 390)
    phone_h = screen_h + border * 2
    radius = round(outer_w * 0.125)
    screen_radius = max(1, radius - border)

    shell = Image.new("RGBA", (outer_w, phone_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shell)
    draw.rounded_rectangle(
        (0, 0, outer_w - 1, phone_h - 1),
        radius=radius,
        fill=(4, 5, 7, 255),
        outline=(88, 91, 98, 255),
        width=max(3, border // 5),
    )
    draw.rounded_rectangle(
        (6, 6, outer_w - 7, phone_h - 7),
        radius=radius - 6,
        outline=(255, 255, 255, 34),
        width=2,
    )

    screen = screen_with_status(capture_name, (screen_w, screen_h))
    screen.putalpha(rounded_mask((screen_w, screen_h), screen_radius))
    shell.alpha_composite(screen, (border, border))

    notch_w = round(outer_w * 0.37)
    notch_h = round(outer_w * 0.078)
    notch_x = (outer_w - notch_w) // 2
    draw.rounded_rectangle(
        (notch_x, border - 1, notch_x + notch_w, border + notch_h),
        radius=round(notch_h * 0.46),
        fill=(2, 3, 5, 255),
    )
    draw.ellipse(
        (
            notch_x + round(notch_w * 0.77),
            border + round(notch_h * 0.32),
            notch_x + round(notch_w * 0.77) + round(notch_h * 0.25),
            border + round(notch_h * 0.57),
        ),
        fill=(7, 20, 42, 255),
    )

    side = (52, 54, 60, 255)
    draw.rounded_rectangle((-3, round(phone_h * 0.24), 5, round(phone_h * 0.34)), radius=4, fill=side)
    draw.rounded_rectangle((outer_w - 6, round(phone_h * 0.28), outer_w + 2, round(phone_h * 0.43)), radius=4, fill=side)

    if opacity < 1:
        shell.putalpha(shell.getchannel("A").point(lambda value: round(value * opacity)))
    return shell


def place_phone(
    canvas: Image.Image,
    capture_name: str,
    outer_w: int,
    x: int,
    y: int,
    rotation: float = 0,
    opacity: float = 1.0,
    shadow_opacity: int = 90,
) -> None:
    phone = build_phone(capture_name, outer_w, opacity)
    if rotation:
        original_w = phone.width
        phone = phone.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
        x -= (phone.width - original_w) // 2

    alpha = phone.getchannel("A").point(lambda value: value * shadow_opacity // 255)
    shadow = Image.new("RGBA", phone.size, (8, 10, 14, 0))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    canvas.alpha_composite(shadow, (x + 12, y + 40))
    canvas.alpha_composite(phone, (x, y))


def render(slide: dict) -> Image.Image:
    canvas = Image.new("RGBA", (W, H), (*PAPER, 255))
    layout = slide["layout"]

    if layout == "explore":
        draw_copy(canvas, slide["lines"], slide["subhead"], x=64, y=110, max_width=960)
        place_phone(canvas, "home-v2.png", 720, 1030, -240, -13, 0.90, 54)
        place_phone(canvas, "explore-v2.png", 980, 110, 790, -12, 1.0, 102)
    elif layout == "pods":
        place_phone(canvas, "home-v2.png", 780, -620, 470, 11, 0.92, 60)
        place_phone(canvas, "pods-v2.png", 940, 220, -430, -12, 1.0, 100)
        draw_copy(
            canvas,
            slide["lines"],
            slide["subhead"],
            x=330,
            y=1815,
            max_width=870,
            align="right",
            headline_size=148,
        )
    elif layout == "chat":
        draw_copy(canvas, slide["lines"], slide["subhead"], x=88, y=118, max_width=1080)
        place_phone(canvas, "inbox-v2.png", 1075, 88, 690, 0, 1.0, 90)
    elif layout == "clubs":
        draw_copy(canvas, slide["lines"], slide["subhead"], x=88, y=135, max_width=1100)
        place_phone(canvas, "club-home-v2.png", 810, 20, 760, 5, 0.90, 72)
        place_phone(canvas, "clubs-v2.png", 865, 315, 980, -8, 1.0, 105)
    elif layout == "club_home":
        draw_copy(canvas, slide["lines"], slide["subhead"], x=88, y=105, max_width=1080)
        place_phone(canvas, "club-home-v2.png", 1075, 88, 700, 0, 1.0, 90)
    else:
        draw_copy(canvas, slide["lines"], slide["subhead"], x=88, y=135, max_width=1120, headline_size=146)
        place_phone(canvas, "meeting-v2.png", 965, 175, 670, -7, 1.0, 98)

    return canvas.convert("RGB")


def contact_sheet(images: list[Image.Image]) -> Image.Image:
    thumb_w = 300
    thumb_h = round(thumb_w * H / W)
    gap = 24
    sheet = Image.new("RGB", (thumb_w * 3 + gap * 4, thumb_h * 2 + gap * 3), (232, 232, 230))
    for index, image in enumerate(images):
        thumb = image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        x = gap + (index % 3) * (thumb_w + gap)
        y = gap + (index // 3) * (thumb_h + gap)
        sheet.paste(thumb, (x, y))
    return sheet


def write_zip(folder: Path, output: Path) -> None:
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(folder.glob("*.png")):
            archive.write(path, arcname=path.name)


def main() -> None:
    OUTPUT_65.mkdir(parents=True, exist_ok=True)
    OUTPUT_69.mkdir(parents=True, exist_ok=True)
    rendered: list[Image.Image] = []
    for slide in SLIDES:
        image = render(slide)
        image.save(OUTPUT_65 / slide["file"], format="PNG", optimize=True)
        modern = ImageOps.fit(image, (1320, 2868), method=Image.Resampling.LANCZOS)
        modern.save(OUTPUT_69 / slide["file"], format="PNG", optimize=True)
        rendered.append(image)
        print(f"wrote {OUTPUT_65 / slide['file']}")
        print(f"wrote {OUTPUT_69 / slide['file']}")

    contact_sheet(rendered).save(ITERATION / "contact-sheet-simple-v4.png", format="PNG", optimize=True)
    write_zip(
        OUTPUT_65,
        ROOT / "Oval-App-Store-Screenshots-SIMPLE-v4-6.5-inch-en-US.zip",
    )
    write_zip(
        OUTPUT_69,
        ROOT / "Oval-App-Store-Screenshots-SIMPLE-v4-6.9-inch-en-US.zip",
    )


if __name__ == "__main__":
    main()
