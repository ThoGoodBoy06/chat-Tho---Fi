# Script đóng gói IPA tự động sửa lỗi đường dẫn
Remove-Item -Path ".\app.ipa" -ErrorAction SilentlyContinue
Remove-Item -Path ".\app.zip" -ErrorAction SilentlyContinue
Remove-Item -Path ".\Payload" -Recurse -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Path ".\Payload" -Force | Out-Null

$source = ""
if (Test-Path ".\Runner.app\Runner.app\Info.plist") {
    $source = ".\Runner.app\Runner.app"
} elseif (Test-Path ".\Runner.app\Info.plist") {
    $source = ".\Runner.app"
} else {
    Write-Host "❌ Không tìm thấy file Info.plist trong Runner.app"
    exit 1
}

Write-Host "📦 Đang copy từ nguồn: $source"
Copy-Item -Path $source -Destination ".\Payload\Runner.app" -Recurse

Write-Host "🗜️ Đang nén file..."
Compress-Archive -Path ".\Payload" -DestinationPath ".\app.zip" -Force

Write-Host "🏷️ Đang đổi tên thành app.ipa..."
Rename-Item -Path ".\app.zip" -NewName "app.ipa"

Remove-Item -Path ".\Payload" -Recurse -Force
Write-Host "🎉 Đã tạo thành công file app.ipa!"
