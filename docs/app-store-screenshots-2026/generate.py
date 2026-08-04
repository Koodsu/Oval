#!/usr/bin/env python3
"""Generate Oval's 6.5-inch App Store screenshot set at 1284x2778."""

from __future__ import annotations

import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
CAPTURES = ROOT / "captures"
GENERATED = ROOT / "generated"
OUTPUT_65 = ROOT / "apple" / "en-US" / "6.5-inch"
OUTPUT_69 = ROOT / "apple" / "en-US" / "6.9-inch"

WIDTH = 1284
HEIGHT = 2778

SCARLET = (215, 9, 18)
INK = (16, 18, 24)
PAPER = (251, 248, 242)

FONT_BOLD = "/System/Library/Fonts/Avenir Next.ttc"
FONT_REGULAR = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT_SERIF_ITALIC = "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf"


STORIES = [
    {
        "file": "01-campus-pulse.png",
        "tone": "paper",
        "headline": [("Campus,", "bold"), ("actually happening.", "accent")],
        "subhead": "See the plans, clubs, and people moving around you.",
        "tag": "Your campus pulse",
        "devices": [("home.png", 850, 217, 790, 0.0, 1.0)],
    },
    {
        "file": "02-explore.png",
        "tone": "scarlet",
        "headline": [("Find your", "bold"), ("next move.", "accent")],
        "subhead": "Browse real small-group plans happening around campus.",
        "tag": "Explore what’s next",
        "devices": [("explore.png", 850, 214, 805, -3.2, 1.0)],
    },
    {
        "file": "03-my-pods.png",
        "tone": "paper",
        "headline": [("Turn “we should”", "bold"), ("into tonight.", "accent")],
        "subhead": "Keep every plan—and the people in it—close at hand.",
        "tag": "Small groups, real plans",
        "devices": [("pods.png", 850, 214, 800, 3.0, 1.0)],
    },
    {
        "file": "04-inbox.png",
        "tone": "dark",
        "headline": [("Stay close to", "bold"), ("your people.", "accent")],
        "subhead": "Messages, pod chats, and invites—together in one place.",
        "tag": "Always in the loop",
        "devices": [("inbox.png", 850, 212, 825, -1.8, 1.0)],
    },
    {
        "file": "05-clubs.png",
        "tone": "paper",
        "headline": [("Clubs that", "bold"), ("feel alive.", "accent")],
        "subhead": "Discover organizations, events, and the people behind them.",
        "tag": "One home for every club",
        "devices": [
            ("club-home.png", 690, 610, 920, 7.0, 0.90),
            ("clubs.png", 740, -20, 835, -6.0, 1.0),
        ],
    },
    {
        "file": "06-club-events.png",
        "tone": "scarlet",
        "headline": [("RSVP & show up.", "bold"), ("Belong.", "accent")],
        "subhead": "Club events from the first invite to check-in.",
        "tag": "Make campus yours",
        "devices": [
            ("club-home.png", 650, -300, 945, -7.0, 0.82),
            ("meeting.png", 825, 225, 820, 1.8, 1.0),
        ],
    },
]


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize(
        (math.ceil(image.width * scale), math.ceil(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def vertical_gradient(top: tuple[int, int, int, int], bottom: tuple[int, int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
        draw.line((0, y, WIDTH, y), fill=color)
    return image


def base_background(tone: str) -> Image.Image:
    art = cover(Image.open(GENERATED / "oval-editorial-background.png").convert("RGBA"), (WIDTH, HEIGHT))
    if tone == "dark":
        overlay = vertical_gradient((13, 17, 28, 245), (13, 17, 28, 142))
    elif tone == "scarlet":
        overlay = vertical_gradient((163, 0, 8, 247), (126, 3, 17, 118))
    else:
        overlay = vertical_gradient((255, 253, 248, 250), (255, 250, 241, 30))
    art = Image.alpha_composite(art, overlay)

    halo = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    if tone == "paper":
        hd.ellipse((850, 200, 1450, 800), fill=(215, 9, 18, 25))
        hd.ellipse((-220, 1180, 430, 1840), fill=(74, 99, 166, 22))
    elif tone == "dark":
        hd.ellipse((760, 120, 1510, 870), fill=(215, 9, 18, 46))
        hd.ellipse((-280, 1380, 420, 2080), fill=(97, 115, 193, 38))
    else:
        hd.ellipse((780, 120, 1490, 830), fill=(255, 216, 206, 34))
        hd.ellipse((-250, 1300, 440, 1990), fill=(24, 38, 75, 34))
    art = Image.alpha_composite(art, halo.filter(ImageFilter.GaussianBlur(95)))

    arcs = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arcs)
    line = (255, 255, 255, 47) if tone in {"dark", "scarlet"} else (215, 9, 18, 34)
    ad.ellipse((915, 350, 1470, 905), outline=line, width=3)
    ad.ellipse((-150, 575, 120, 845), outline=line, width=3)
    return Image.alpha_composite(art, arcs)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def paste_shadowed(
    base: Image.Image,
    layer: Image.Image,
    xy: tuple[int, int],
    *,
    blur: int,
    offset: tuple[int, int],
    opacity: int,
) -> None:
    shadow = Image.new("RGBA", layer.size, (10, 10, 12, 0))
    alpha = layer.getchannel("A").point(lambda p: p * opacity // 255)
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow, (xy[0] + offset[0], xy[1] + offset[1]))
    base.alpha_composite(layer, xy)


def build_device(filename: str, width: int, opacity: float = 1.0) -> Image.Image:
    source = Image.open(CAPTURES / filename).convert("RGBA")
    border = max(14, round(width * 0.021))
    screen_w = width - 2 * border
    screen_h = round(screen_w * source.height / source.width)
    screen = source.resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    screen_mask = rounded_mask((screen_w, screen_h), round(screen_w * 0.105))
    screen.putalpha(screen_mask)

    device_h = screen_h + 2 * border
    shell = Image.new("RGBA", (width, device_h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shell)
    radius = round(width * 0.122)
    sd.rounded_rectangle((0, 0, width - 1, device_h - 1), radius=radius, fill=(7, 8, 11, 255), outline=(87, 89, 96, 255), width=2)
    sd.rounded_rectangle((4, 4, width - 5, device_h - 5), radius=max(1, radius - 4), outline=(255, 255, 255, 28), width=2)
    shell.alpha_composite(screen, (border, border))
    if opacity < 1:
        shell.putalpha(shell.getchannel("A").point(lambda p: round(p * opacity)))
    return shell


def place_device(
    canvas: Image.Image,
    filename: str,
    width: int,
    x: int,
    y: int,
    rotation: float,
    opacity: float,
) -> None:
    device = build_device(filename, width, opacity)
    if rotation:
        device = device.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
        x -= (device.width - width) // 2
    paste_shadowed(canvas, device, (x, y), blur=34, offset=(0, 55), opacity=110)


def font(path: str, size: int, variation: str | None = None) -> ImageFont.FreeTypeFont:
    loaded = ImageFont.truetype(path, size)
    if variation:
        try:
            loaded.set_variation_by_name(variation)
        except (OSError, ValueError):
            pass
    return loaded


def fitted_font(path: str, text: str, start: int, max_width: int, variation: str | None = None) -> ImageFont.FreeTypeFont:
    size = start
    while size > 60:
        loaded = font(path, size, variation)
        box = loaded.getbbox(text)
        if box[2] - box[0] <= max_width:
            return loaded
        size -= 2
    return font(path, size, variation)


def draw_brand(canvas: Image.Image, tone: str) -> None:
    x, y = 86, 96
    pill_w, pill_h = 337, 68
    pill = Image.new("RGBA", (pill_w, pill_h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    if tone == "paper":
        fill, outline, text_color = (255, 255, 255, 214), (16, 18, 24, 28), INK
    else:
        fill, outline, text_color = (255, 255, 255, 30), (255, 255, 255, 58), (255, 255, 255)
    pd.rounded_rectangle((0, 0, pill_w - 1, pill_h - 1), radius=34, fill=fill, outline=outline, width=1)
    icon = Image.open(GENERATED / "oval-app-icon.png").convert("RGBA").resize((52, 52), Image.Resampling.LANCZOS)
    icon.putalpha(rounded_mask(icon.size, 15))
    pill.alpha_composite(icon, (8, 8))
    pd.text((78, 18), "Oval for Ohio State", font=font(FONT_BOLD, 27), fill=text_color, anchor="la")
    paste_shadowed(canvas, pill, (x, y), blur=18, offset=(0, 13), opacity=44)


def draw_copy(canvas: Image.Image, story: dict) -> None:
    tone = story["tone"]
    draw = ImageDraw.Draw(canvas)
    bold_color = (255, 255, 255) if tone in {"dark", "scarlet"} else INK
    accent_color = (255, 240, 207) if tone == "scarlet" else ((255, 112, 119) if tone == "dark" else SCARLET)
    sub_color = (255, 255, 255, 204) if tone == "scarlet" else ((255, 255, 255, 184) if tone == "dark" else (78, 80, 88, 255))

    y = 220
    for line, style in story["headline"]:
        if style == "accent":
            headline_font = fitted_font(FONT_SERIF_ITALIC, line, 116, 1110)
            color = accent_color
        else:
            headline_font = fitted_font(FONT_BOLD, line, 116, 1110)
            color = bold_color
        draw.text((86, y), line, font=headline_font, fill=color, anchor="la", stroke_width=0)
        y += 118

    body_font = font(FONT_REGULAR, 38)
    wrapped = textwrap.wrap(story["subhead"], width=54, break_long_words=False)
    draw.multiline_text((86, y + 24), "\n".join(wrapped), font=body_font, fill=sub_color, spacing=10)


def draw_tag(canvas: Image.Image, text: str, tone: str) -> None:
    tag_font = font(FONT_BOLD, 25)
    box = tag_font.getbbox(text)
    text_w = box[2] - box[0]
    w, h = text_w + 88, 66
    x, y = WIDTH - w - 68, HEIGHT - h - 66
    tag = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(tag)
    if tone == "paper":
        fill, outline, text_color, dot = (255, 255, 255, 218), (255, 255, 255, 148), INK, SCARLET
    else:
        fill, outline, text_color, dot = (10, 12, 18, 118), (255, 255, 255, 48), (255, 255, 255), (255, 240, 207)
    td.rounded_rectangle((0, 0, w - 1, h - 1), radius=33, fill=fill, outline=outline, width=1)
    td.ellipse((24, 27, 36, 39), fill=dot)
    td.ellipse((18, 21, 42, 45), outline=(*dot, 58), width=6)
    td.text((53, h // 2), text, font=tag_font, fill=text_color, anchor="lm")
    paste_shadowed(canvas, tag, (x, y), blur=18, offset=(0, 13), opacity=42)


def generate_story(story: dict) -> Image.Image:
    canvas = base_background(story["tone"])
    for device in story["devices"]:
        place_device(canvas, *device)
    draw_brand(canvas, story["tone"])
    draw_copy(canvas, story)
    draw_tag(canvas, story["tag"], story["tone"])
    return canvas.convert("RGB")


def contact_sheet(images: list[Image.Image]) -> Image.Image:
    thumb_w = 300
    thumb_h = round(thumb_w * HEIGHT / WIDTH)
    gap = 24
    sheet = Image.new("RGB", (thumb_w * 3 + gap * 4, thumb_h * 2 + gap * 3), (238, 236, 232))
    for index, image in enumerate(images):
        thumb = image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        x = gap + (index % 3) * (thumb_w + gap)
        y = gap + (index // 3) * (thumb_h + gap)
        sheet.paste(thumb, (x, y))
    return sheet


def main() -> None:
    OUTPUT_65.mkdir(parents=True, exist_ok=True)
    OUTPUT_69.mkdir(parents=True, exist_ok=True)
    rendered: list[Image.Image] = []
    for story in STORIES:
        image = generate_story(story)
        image.save(OUTPUT_65 / story["file"], format="PNG", optimize=True)
        modern = ImageOps.fit(image, (1320, 2868), method=Image.Resampling.LANCZOS)
        modern.save(OUTPUT_69 / story["file"], format="PNG", optimize=True)
        rendered.append(image)
        print(f"wrote {OUTPUT_65 / story['file']}")
        print(f"wrote {OUTPUT_69 / story['file']}")
    contact_sheet(rendered).save(ROOT / "contact-sheet.png", format="PNG", optimize=True)
    print(f"wrote {ROOT / 'contact-sheet.png'}")


if __name__ == "__main__":
    main()
