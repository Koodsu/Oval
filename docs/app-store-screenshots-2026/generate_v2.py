#!/usr/bin/env python3
"""Varied, community-first App Store screenshots for Oval."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
CAPTURES = ROOT / "captures"
GENERATED = ROOT / "generated"
OUTPUT_65 = ROOT / "iteration-v3" / "apple" / "en-US" / "6.5-inch"
OUTPUT_69 = ROOT / "iteration-v3" / "apple" / "en-US" / "6.9-inch"

W, H = 1284, 2778
INK = (15, 17, 22)
CREAM = (255, 246, 222)
WHITE = (255, 255, 255)

FONT_BOLD = "/System/Library/Fonts/Avenir Next.ttc"
FONT_REGULAR = "/System/Library/Fonts/HelveticaNeue.ttc"


STORIES = [
    {
        "file": "01-campus-together.png",
        "header": (215, 9, 18),
        "headline": [("CAMPUS,", None), ("TOGETHER.", (255, 210, 63))],
        "headline_color": WHITE,
        "highlight_color": INK,
        "subhead": "Plans, clubs, and people—all moving right now.",
        "layout": "hero",
    },
    {
        "file": "02-find-your-people.png",
        "header": (27, 85, 217),
        "headline": [("FIND YOUR", None), ("PEOPLE.", (255, 210, 63))],
        "headline_color": WHITE,
        "highlight_color": INK,
        "subhead": "See what’s happening, then jump into the plan.",
        "layout": "duo",
    },
    {
        "file": "03-bring-a-crew.png",
        "header": (82, 196, 159),
        "headline": [("MAKE A PLAN.", None), ("BRING A CREW.", (215, 9, 18))],
        "headline_color": INK,
        "highlight_color": WHITE,
        "subhead": "Your next five hangouts, all ready to happen.",
        "layout": "fan",
    },
    {
        "file": "04-clubs-with-a-pulse.png",
        "header": (255, 210, 63),
        "headline": [("CLUBS WITH", None), ("A PULSE.", (215, 9, 18))],
        "headline_color": INK,
        "highlight_color": WHITE,
        "subhead": "Find your communities and see what’s happening tonight.",
        "layout": "club_stack",
    },
    {
        "file": "05-in-the-loop.png",
        "header": (126, 91, 204),
        "headline": [("EVERYONE’S", None), ("IN THE LOOP.", (255, 210, 63))],
        "headline_color": WHITE,
        "highlight_color": INK,
        "subhead": "Messages, pod chats, and invites—without the chaos.",
        "layout": "detail_grid",
    },
    {
        "file": "06-show-up-together.png",
        "header": (215, 9, 18),
        "headline": [("SHOW UP", None), ("TOGETHER.", (82, 196, 159))],
        "headline_color": WHITE,
        "highlight_color": INK,
        "subhead": "From RSVP to check-in, keep the whole group moving.",
        "layout": "spotlight",
    },
]


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def fit_font(text: str, start: int, max_width: int) -> ImageFont.FreeTypeFont:
    size = start
    while size >= 56:
        candidate = font(FONT_BOLD, size)
        box = candidate.getbbox(text)
        if box[2] - box[0] <= max_width:
            return candidate
        size -= 2
    return font(FONT_BOLD, size)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def alpha_shadow(layer: Image.Image, opacity: int = 110, blur: int = 28) -> Image.Image:
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    alpha = layer.getchannel("A").point(lambda value: value * opacity // 255)
    shadow.putalpha(alpha)
    return shadow.filter(ImageFilter.GaussianBlur(blur))


def base_canvas() -> Image.Image:
    background = Image.open(GENERATED / "oval-community-background-v3-no-tape.png").convert("RGBA")
    canvas = cover(background, (W, H))
    return Image.alpha_composite(canvas, Image.new("RGBA", (W, H), (255, 246, 222, 18)))


def wrap_text(text: str, text_font: ImageFont.FreeTypeFont, max_width: int) -> str:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if text_font.getlength(candidate) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return "\n".join(lines)


def header_geometry(layout: str) -> tuple[Image.Image, tuple[int, int, int, int]]:
    layer = Image.new("RGBA", (W, 1120), (0, 0, 0, 0))
    if layout == "hero":
        return layer, (54, 122, 900, 100)
    if layout == "duo":
        return layer, (62, 116, 850, 94)
    if layout == "fan":
        return layer, (70, 105, 1120, 90)
    if layout == "club_stack":
        return layer, (350, 98, 860, 100)
    if layout == "detail_grid":
        return layer, (250, 98, 930, 98)
    return layer, (48, 92, 740, 104)


def poster_header(canvas: Image.Image, story: dict) -> tuple[int, int, int, int]:
    layout = story["layout"]
    layer, text_spec = header_geometry(layout)
    draw = ImageDraw.Draw(layer)
    color = (*story["header"], 255)

    if layout == "hero":
        draw.polygon([(20, 28), (1034, 44), (1120, 420), (920, 566), (28, 524)], fill=color)
    elif layout == "duo":
        draw.polygon([(25, 82), (946, 24), (1034, 468), (114, 552)], fill=(255, 210, 63, 255))
        draw.polygon([(38, 32), (944, 70), (982, 500), (16, 472)], fill=color)
    elif layout == "fan":
        draw.polygon([(22, 26), (1264, 50), (1198, 548), (840, 510), (604, 560), (230, 516), (38, 548)], fill=color)
        draw.line((780, 42, 1190, 500), fill=(255, 255, 255, 72), width=11)
    elif layout == "club_stack":
        draw.polygon([(280, 28), (1264, 48), (1250, 558), (348, 524), (250, 330)], fill=color)
        draw.polygon([(214, 48), (340, 24), (410, 542), (286, 560)], fill=(215, 9, 18, 255))
    elif layout == "detail_grid":
        draw.rounded_rectangle((190, 34, 1260, 524), radius=54, fill=color)
        draw.polygon([(252, 508), (430, 508), (250, 626)], fill=color)
        draw.rounded_rectangle((164, 76, 226, 426), radius=22, fill=(255, 210, 63, 255))
    else:
        draw.polygon([(22, 24), (846, 42), (908, 522), (792, 660), (32, 628)], fill=color)
        draw.polygon([(760, 70), (892, 96), (872, 508), (804, 572)], fill=(82, 196, 159, 255))

    # Halftone and marker accents vary with the shape, but remain text-free.
    dot_x = 900 if layout not in {"club_stack", "detail_grid", "spotlight"} else 1080
    dot_y = 80
    for row in range(4):
        for col in range(6):
            x = dot_x + col * 32
            y = dot_y + row * 32
            draw.ellipse((x, y, x + 9, y + 9), fill=(255, 255, 255, 80))
    canvas.alpha_composite(layer, (0, 0))
    return text_spec


def draw_headline(canvas: Image.Image, story: dict, spec: tuple[int, int, int, int]) -> None:
    x, y, max_width, start_size = spec
    draw = ImageDraw.Draw(canvas)
    for text, highlight in story["headline"]:
        text_font = fit_font(text, start_size, max_width)
        box = draw.textbbox((0, 0), text, font=text_font)
        text_w = box[2] - box[0]
        text_h = box[3] - box[1]
        if highlight:
            pad_x, pad_y = 20, 8
            draw.rounded_rectangle(
                (x, y - 3, x + text_w + pad_x * 2, y + text_h + pad_y * 2),
                radius=17,
                fill=highlight,
            )
            draw.text((x + pad_x, y + pad_y - box[1]), text, font=text_font, fill=story["highlight_color"], anchor="la")
        else:
            draw.text((x, y - box[1]), text, font=text_font, fill=story["headline_color"], anchor="la")
        y += max(91, text_h + 18)

    body_font = font(FONT_REGULAR, 35 if max_width > 600 else 31)
    wrapped = wrap_text(story["subhead"], body_font, max_width)
    draw.multiline_text((x + 2, y + 18), wrapped, font=body_font, fill=story["headline_color"], spacing=7)


def screen_slab(
    capture_name: str,
    outer_w: int,
    crop: tuple[int, int, int, int] | None = None,
    compact: bool = False,
) -> Image.Image:
    source = Image.open(CAPTURES / capture_name).convert("RGBA")
    if crop is not None:
        source = source.crop(crop)
    elif capture_name != "meeting-v2.png":
        source = source.crop((0, 0, source.width, 832))

    border = max(7, round(outer_w * 0.011))
    screen_w = outer_w - border * 2
    screen_h = round(screen_w * source.height / source.width)
    source = source.resize((screen_w, screen_h), Image.Resampling.LANCZOS)
    radius = max(28, round(screen_w * (0.045 if compact else 0.066)))
    source.putalpha(rounded_mask((screen_w, screen_h), radius))
    slab = Image.new("RGBA", (outer_w, screen_h + border * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(slab)
    draw.rounded_rectangle(
        (0, 0, slab.width - 1, slab.height - 1),
        radius=radius + border,
        fill=(*INK, 255),
        outline=(*CREAM, 255),
        width=max(3, border // 2),
    )
    slab.alpha_composite(source, (border, border))
    return slab


def place_center(
    canvas: Image.Image,
    layer: Image.Image,
    center: tuple[int, int],
    angle: float = 0,
    shadow: int = 116,
    blur: int = 30,
) -> tuple[int, int, int, int]:
    rotated = layer.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    x = round(center[0] - rotated.width / 2)
    y = round(center[1] - rotated.height / 2)
    canvas.alpha_composite(alpha_shadow(rotated, shadow, blur), (x + 8, y + 34))
    canvas.alpha_composite(rotated, (x, y))
    return x, y, rotated.width, rotated.height


def add_doodles(canvas: Image.Image, layout: str) -> None:
    draw = ImageDraw.Draw(canvas)
    if layout in {"hero", "fan", "detail_grid"}:
        draw.ellipse((26, 2320, 104, 2398), fill=(255, 210, 63), outline=INK, width=5)
        draw.line((51, 2359, 79, 2359), fill=INK, width=5)
        draw.line((65, 2345, 65, 2373), fill=INK, width=5)
    if layout in {"duo", "club_stack", "spotlight"}:
        draw.polygon([(1162, 2320), (1214, 2386), (1133, 2378)], fill=(126, 91, 204), outline=INK)
    draw.arc((1015, 2520, 1370, 2840), 170, 318, fill=(255, 246, 222), width=9)


def layout_hero(canvas: Image.Image) -> None:
    phone = screen_slab("home-v2.png", 1030)
    place_center(canvas, phone, (690, 1710), -4.5, 125, 34)


def layout_duo(canvas: Image.Image) -> None:
    # A discovery screen and a home screen overlap like flyers on a board.
    rear = screen_slab("home-v2.png", 690)
    front = screen_slab("explore-v2.png", 790)
    place_center(canvas, rear, (940, 1720), 9, 96, 26)
    place_center(canvas, front, (430, 1715), -7, 128, 34)


def layout_fan(canvas: Image.Image) -> None:
    # Three real screens create a social "crew" fan instead of one repeated hero phone.
    left = screen_slab("home-v2.png", 610)
    right = screen_slab("explore-v2.png", 610)
    center = screen_slab("pods-v2.png", 735)
    place_center(canvas, left, (305, 1740), -14, 80, 24)
    place_center(canvas, right, (985, 1740), 14, 80, 24)
    place_center(canvas, center, (645, 1780), 0, 136, 36)


def layout_club_stack(canvas: Image.Image) -> None:
    # List-to-community progression in one frame: browse at back, live club page in front.
    browse = screen_slab("clubs-v2.png", 760)
    club = screen_slab("club-home-v2.png", 760)
    place_center(canvas, browse, (420, 1725), -9, 90, 26)
    place_center(canvas, club, (865, 1730), 7, 132, 34)


def layout_detail_grid(canvas: Image.Image) -> None:
    # A clean, aligned feature grid: the combined inbox plus two distinct filtered states.
    full = screen_slab("inbox-v2.png", 700)
    chats = screen_slab("inbox-pod-chats-v3.png", 475, crop=(0, 0, 390, 500), compact=True)
    invites = screen_slab("inbox-invites-v3.png", 475, crop=(0, 0, 390, 460), compact=True)
    place_center(canvas, full, (390, 1740), 0, 116, 30)
    place_center(canvas, chats, (980, 1375), 0, 108, 26)
    place_center(canvas, invites, (980, 2070), 0, 108, 26)


def layout_spotlight(canvas: Image.Image) -> None:
    # Supporting club frames sit behind the main RSVP/check-in flow.
    club = screen_slab("club-home-v2.png", 520, crop=(0, 0, 390, 520), compact=True)
    browse = screen_slab("clubs-v2.png", 520, crop=(0, 115, 390, 665), compact=True)
    meeting = screen_slab("meeting-v2.png", 785)
    place_center(canvas, club, (380, 1175), -9, 78, 22)
    place_center(canvas, browse, (320, 2070), 8, 78, 22)
    place_center(canvas, meeting, (870, 1660), 5, 138, 36)


LAYOUTS = {
    "hero": layout_hero,
    "duo": layout_duo,
    "fan": layout_fan,
    "club_stack": layout_club_stack,
    "detail_grid": layout_detail_grid,
    "spotlight": layout_spotlight,
}


def render(story: dict) -> Image.Image:
    canvas = base_canvas()
    spec = poster_header(canvas, story)
    add_doodles(canvas, story["layout"])
    LAYOUTS[story["layout"]](canvas)
    # Headlines are drawn last so phone overlap can feel intentional without hurting copy.
    draw_headline(canvas, story, spec)
    return canvas.convert("RGB")


def contact_sheet(images: list[Image.Image]) -> Image.Image:
    thumb_w = 300
    thumb_h = round(thumb_w * H / W)
    gap = 24
    sheet = Image.new("RGB", (thumb_w * 3 + gap * 4, thumb_h * 2 + gap * 3), (18, 19, 23))
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
        image = render(story)
        image.save(OUTPUT_65 / story["file"], format="PNG", optimize=True)
        modern = ImageOps.fit(image, (1320, 2868), method=Image.Resampling.LANCZOS)
        modern.save(OUTPUT_69 / story["file"], format="PNG", optimize=True)
        rendered.append(image)
        print(f"wrote {story['file']}")
    contact_sheet(rendered).save(ROOT / "iteration-v3" / "contact-sheet-v3.png", format="PNG", optimize=True)


if __name__ == "__main__":
    main()
