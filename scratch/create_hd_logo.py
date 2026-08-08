from PIL import Image, ImageDraw, ImageFilter
import math
import os

def create_crisp_logo(size=2048):
    # Render at 4x resolution for super-sampled anti-aliasing
    scale = 2
    render_size = size * scale
    img = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = render_size / 2, render_size / 2
    
    # Gradient map setup
    # Electric Cyan #00E5FF -> Blue #0068FF -> Purple #9000FF -> Magenta #E000FF
    colors = [
        (0, 229, 255),   # Cyan
        (0, 104, 255),   # Royal Blue
        (144, 0, 255),   # Purple
        (224, 0, 255)    # Magenta
    ]

    def get_color(factor):
        # factor from 0.0 to 1.0
        factor = max(0.0, min(1.0, factor))
        idx = factor * (len(colors) - 1)
        i1 = int(idx)
        i2 = min(i1 + 1, len(colors) - 1)
        t = idx - i1
        r = int(colors[i1][0] * (1 - t) + colors[i2][0] * t)
        g = int(colors[i1][1] * (1 - t) + colors[i2][1] * t)
        b = int(colors[i2][2] * (1 - t) + colors[i2][2] * t)
        return (r, g, b, 255)

    # Draw Chat Bubble outline & Wi-Fi signal using high-resolution paths
    # We create a mask for the gradient fill
    mask = Image.new('L', (render_size, render_size), 0)
    mask_draw = ImageDraw.Draw(mask)

    # 1. Main Chat Bubble Outline (Stroke width ~ 100px)
    stroke_w = int(110 * scale)
    bubble_radius = int(550 * scale)

    # Draw speech bubble body (rounded rectangle / ellipse)
    bubble_left = cx - bubble_radius + 40
    bubble_top = cy - bubble_radius + 80
    bubble_right = cx + bubble_radius - 80
    bubble_bottom = cy + bubble_radius - 40

    # Draw main thick rounded outline
    mask_draw.ellipse([bubble_left, bubble_top, bubble_right, bubble_bottom], outline=255, width=stroke_w)

    # Cut out tail gap at bottom left
    tail_x = bubble_left + 140
    tail_y = bubble_bottom - 120
    mask_draw.polygon([
        (tail_x - 60, tail_y - 20),
        (tail_x - 180, tail_y + 160),
        (tail_x + 120, tail_y + 40)
    ], fill=255)

    # Cut out small inner circle inside tail junction for smooth curve
    # Wi-Fi Arcs radiating from top right corner
    wifi_center_x = bubble_right - 100
    wifi_center_y = bubble_top + 100

    # Arc 1
    r1 = int(220 * scale)
    mask_draw.arc([wifi_center_x - r1, wifi_center_y - r1, wifi_center_x + r1, wifi_center_y + r1], start=280, end=350, fill=255, width=stroke_w)
    
    # Arc 2
    r2 = int(360 * scale)
    mask_draw.arc([wifi_center_x - r2, wifi_center_y - r2, wifi_center_x + r2, wifi_center_y + r2], start=280, end=350, fill=255, width=stroke_w)

    # 3 Dots inside chat bubble
    dot_y = int(cy + 40 * scale)
    dot_r = int(36 * scale)
    dot_xs = [int(cx - 160 * scale), int(cx), int(cx + 160 * scale)]
    for dx in dot_xs:
        mask_draw.ellipse([dx - dot_r, dot_y - dot_r, dx + dot_r, dot_y + dot_r], fill=255)

    # Generate Vibrant Gradient Surface
    grad_surf = Image.new('RGBA', (render_size, render_size), (0, 0, 0, 0))
    grad_pixels = grad_surf.load()
    for y in range(render_size):
        for x in range(render_size):
            # Diagonal gradient factor from top-left (0,0) to bottom-right (w,h)
            factor = (x / render_size * 0.5) + (y / render_size * 0.5)
            grad_pixels[x, y] = get_color(factor)

    # Apply mask to gradient surface
    grad_surf.putalpha(mask)

    # Downsample with Lanczos for ultra-crisp anti-aliased 1024x1024 PNG
    final_img = grad_surf.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

if __name__ == '__main__':
    logo = create_crisp_logo(1024)
    logo.save('public/tho_fi_logo_transparent.png')
    logo.save('flutter_frontend/assets/tho_fi_logo_transparent.png')
    logo.save('flutter_frontend/web/tho_fi_logo_transparent.png')
    print('Crisp 1024x1024 transparent logo created successfully!')
