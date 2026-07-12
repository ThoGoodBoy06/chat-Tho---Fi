import os
import sys
import subprocess

# Tự động cài đặt Pillow nếu chưa có
try:
    from PIL import Image, ImageChops
except ImportError:
    print("📦 Đang cài đặt thư viện xử lý ảnh Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageChops

def crop_image_logo(image_path, padding_percent=0.15):
    if not os.path.exists(image_path):
        print(f"❌ Không tìm thấy file: {image_path}")
        return

    print(f"🖼️ Đang xử lý ảnh: {image_path}")
    img = Image.open(image_path).convert("RGBA")
    
    # Tìm bounding box của vùng chứa logo (bỏ qua vùng nền màu trắng hoặc alpha = 0)
    # Ở đây nền là màu trắng tinh (255, 255, 255, 255) hoặc trong suốt
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    diff = ImageChops.difference(img, bg)
    
    # Bounding box [left, upper, right, lower]
    bbox = diff.getbbox()
    if not bbox:
        print("⚠️ Không phát hiện vùng logo khác biệt với nền trắng.")
        return

    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    
    # Thêm padding để logo không bị sát mép quá
    pad_w = int(width * padding_percent)
    pad_h = int(height * padding_percent)
    
    # Đảm bảo padding không vượt quá kích thước ảnh gốc
    new_left = max(0, left - pad_w)
    new_top = max(0, top - pad_h)
    new_right = min(img.width, right + pad_w)
    new_bottom = min(img.height, bottom + pad_h)
    
    # Cắt ảnh
    cropped_img = img.crop((new_left, new_top, new_right, new_bottom))
    
    # Resize về kích thước vuông tiêu chuẩn 1024x1024 để làm icon sắc nét
    target_size = (1024, 1024)
    
    # Tạo nền trắng
    final_img = Image.new("RGBA", target_size, (255, 255, 255, 255))
    
    # Tính toán resize giữ nguyên tỷ lệ
    cropped_w, cropped_h = cropped_img.size
    ratio = min(target_size[0] / cropped_w, target_size[1] / cropped_h)
    new_w = int(cropped_w * ratio)
    new_h = int(cropped_h * ratio)
    
    resized_logo = cropped_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Dán logo vào giữa nền trắng
    offset_x = (target_size[0] - new_w) // 2
    offset_y = (target_size[1] - new_h) // 2
    final_img.paste(resized_logo, (offset_x, offset_y), resized_logo)
    
    # Lưu đè lại file ảnh gốc
    final_img.convert("RGB").save(image_path, "PNG")
    print("✅ Đã crop và tối ưu hóa logo thành công!")

if __name__ == "__main__":
    icon_path = os.path.join("mobile_app", "assets", "icon.png")
    crop_image_logo(icon_path)
