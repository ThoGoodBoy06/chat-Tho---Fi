from PIL import Image
import os

path = os.path.join("mobile_app", "assets", "icon.png")
img = Image.open(path).convert("RGBA")
print(f"Size: {img.size}")
data = img.getdata()

non_white = 0
for r, g, b, a in data:
    # Coi là màu khác nếu không phải màu trắng tinh (255, 255, 255)
    if r < 250 or g < 250 or b < 250:
        non_white += 1

print(f"Total non-white pixels: {non_white}")
