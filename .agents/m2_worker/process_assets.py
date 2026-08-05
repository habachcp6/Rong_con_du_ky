import os
import sys
import glob
from PIL import Image

BRAIN_DIR = r"C:\Users\hahoa\.gemini\antigravity\brain\4f16e971-c6e0-4f60-98cd-19af33d97094"
PUBLIC_LANDMARKS_DIR = r"d:\Hackthon-GG2026\public\assets\landmarks"
PUBLIC_ICONS_DIR = r"d:\Hackthon-GG2026\public\assets\landmark-icons"

POSTCARDS = [
    ("postcard_dragon_bridge", "dragon-bridge.png"),
    ("postcard_my_khe", "my-khe.png"),
    ("postcard_marble_mountains", "marble-mountains.png"),
    ("postcard_son_tra", "son-tra.png"),
    ("postcard_han_river_bridge", "han-river-bridge.png"),
    ("postcard_linh_ung", "linh-ung.png"),
    ("postcard_cham_museum", "cham-museum.png"),
    ("postcard_non_nuoc", "non-nuoc.png"),
    ("postcard_han_market", "han-market.png"),
    ("postcard_ba_na_hills", "ba-na-hills.png"),
]

ICONS = [
    ("icon_dragon_bridge", "dragon-bridge.png"),
    ("icon_my_khe", "my-khe-beach.png"),
    ("icon_marble_mountains", "marble-mountains.png"),
    ("icon_son_tra", "son-tra-peninsula.png"),
    ("icon_han_river_bridge", "han-river-bridge.png"),
    ("icon_linh_ung", "linh-ung-son-tra.png"),
    ("icon_cham_museum", "cham-museum.png"),
    ("icon_non_nuoc", "non-nuoc-stone-village.png"),
    ("icon_han_market", "han-market.png"),
    ("icon_ba_na_hills", "ba-na-hills.png"),
]

def find_latest_file(prefix):
    pattern = os.path.join(BRAIN_DIR, f"{prefix}_*")
    matches = glob.glob(pattern)
    if not matches:
        raise FileNotFoundError(f"No file matching {pattern}")
    matches.sort(key=os.path.getmtime, reverse=True)
    return matches[0]

def process_postcards():
    os.makedirs(PUBLIC_LANDMARKS_DIR, exist_ok=True)
    for prefix, target_name in POSTCARDS:
        src_path = find_latest_file(prefix)
        print(f"Processing postcard {prefix} -> {target_name} from {src_path}")
        im = Image.open(src_path).convert("RGBA")
        # Crop to 16:9 ratio if needed then resize to 320x180
        w, h = im.size
        target_ratio = 16.0 / 9.0
        current_ratio = w / float(h)
        if abs(current_ratio - target_ratio) > 0.01:
            if current_ratio > target_ratio:
                # Too wide
                new_w = int(h * target_ratio)
                left = (w - new_w) // 2
                im = im.crop((left, 0, left + new_w, h))
            else:
                # Too tall
                new_h = int(w / target_ratio)
                top = (h - new_h) // 2
                im = im.crop((0, top, w, top + new_h))
        im_resized = im.resize((320, 180), Image.Resampling.LANCZOS)
        dst_path = os.path.join(PUBLIC_LANDMARKS_DIR, target_name)
        # Convert back to RGB or RGBA PNG
        im_resized.save(dst_path, format="PNG")
        print(f"Saved {dst_path} (320x180)")

def process_icons():
    os.makedirs(PUBLIC_ICONS_DIR, exist_ok=True)
    for prefix, target_name in ICONS:
        src_path = find_latest_file(prefix)
        print(f"Processing icon {prefix} -> {target_name} from {src_path}")
        im = Image.open(src_path).convert("RGBA")
        
        # Resize to 48x48 first or process transparency then resize
        # Let's resize first to 48x48
        im_resized = im.resize((48, 48), Image.Resampling.LANCZOS)
        
        # Make background transparent
        # Inspect top-left / top-right / corner pixels to identify background color
        pixels = list(im_resized.getdata())
        corner_colors = [
            pixels[0], pixels[47], pixels[48*47], pixels[48*48 - 1]
        ]
        # Check if background is magenta-ish or white-ish or light solid color
        # Let's define distance function in RGB
        def color_dist(c1, c2):
            return abs(c1[0]-c2[0]) + abs(c1[1]-c2[1]) + abs(c1[2]-c2[2])

        # Pick most common corner color as background
        bg_color = corner_colors[0]
        
        new_pixels = []
        for p in pixels:
            # Check distance to bg_color or pure magenta (255, 0, 255) or white (255, 255, 255)
            if color_dist(p, bg_color) < 60 or color_dist(p, (255, 0, 255)) < 80 or (p[0] > 240 and p[1] < 50 and p[2] > 240):
                new_pixels.append((0, 0, 0, 0))
            else:
                new_pixels.append(p)
        
        im_transparent = Image.new("RGBA", (48, 48))
        im_transparent.putdata(new_pixels)
        
        dst_path = os.path.join(PUBLIC_ICONS_DIR, target_name)
        im_transparent.save(dst_path, format="PNG")
        print(f"Saved {dst_path} (48x48 PNG transparent)")

if __name__ == "__main__":
    process_postcards()
    process_icons()
