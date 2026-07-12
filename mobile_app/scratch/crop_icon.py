import os
import sys
import subprocess

# Tự động cài đặt Pillow nếu chưa có
try:
    from PIL import Image
except ImportError:
    print("📦 Đang cài đặt thư viện xử lý ảnh Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def crop_image_logo_manual(image_path, padding_percent=0.03):
    if not os.path.exists(image_path):
        print(f"❌ Không tìm thấy file: {image_path}")
        return

    print(f"🖼️ Đang xử lý ảnh bằng quét pixel thủ công: {image_path}")
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    
    # Quét pixel để tìm vùng chứa logo
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    
    # Lấy dữ liệu pixel
    pixels = img.load()
    
    # Chúng ta quét toàn bộ tọa độ
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Nếu pixel không phải là màu trắng tinh khiết/gần trắng và không trong suốt
            if (r < 253 or g < 253 or b < 253) and a > 10:
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
                
    if max_x < min_x or max_y < min_y:
        print("⚠️ Không tìm thấy logo qua quét pixel thủ công.")
        return

    logo_w = max_x - min_x
    logo_h = max_y - min_y
    print(f"📏 Tọa độ logo phát hiện: X[{min_x} -> {max_x}] Y[{min_y} -> {max_y}] (Kích thước: {logo_w}x{logo_h})")

    # Thêm padding cực nhỏ
    pad_w = int(logo_w * padding_percent)
    pad_h = int(logo_h * padding_percent)
    
    new_left = max(0, min_x - pad_w)
    new_top = max(0, min_y - pad_h)
    new_right = min(width, max_x + pad_w)
    new_bottom = min(height, max_y + pad_h)
    
    # Cắt ảnh logo
    cropped_img = img.crop((new_left, new_top, new_right, new_bottom))
    
    # Tạo ảnh vuông 1024x1024 nền trắng tinh
    target_size = (1024, 1024)
    final_img = Image.new("RGBA", target_size, (255, 255, 255, 255))
    
    # Tính toán tỷ lệ resize
    cropped_w, cropped_h = cropped_img.size
    ratio = min(target_size[0] / cropped_w, target_size[1] / cropped_h)
    
    # Phóng to chiếm 96% khung hình (để logo siêu to giống ảnh mẫu của bạn)
    scale_factor = 0.96
    new_w = int(cropped_w * ratio * scale_factor)
    new_h = int(cropped_h * ratio * scale_factor)
    
    resized_logo = cropped_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Dán vào giữa
    offset_x = (target_size[0] - new_w) // 2
    offset_y = (target_size[1] - new_h) // 2
    final_img.paste(resized_logo, (offset_x, offset_y), resized_logo)
    
    # Lưu đè lại file ảnh gốc dưới dạng RGB
    final_img.convert("RGB").save(image_path, "PNG")
    print("✅ Đã phóng to tối đa logo thành công bằng quét pixel!")

if __name__ == "__main__":
    icon_path = os.path.join("mobile_app", "assets", "icon.png")
    crop_image_logo_manual(icon_path)
