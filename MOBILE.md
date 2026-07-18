# Hanzi Lens trên Android

Ứng dụng Android dùng Capacitor để mở bản Next.js đã được deploy. Backend OCR và AI vẫn chạy trên server; vì vậy APK cần Internet và một URL HTTPS đang hoạt động.

## Build APK local

Yêu cầu: JDK 21, Android Studio/Android SDK và Node.js 22 trở lên.

```powershell
$env:CAPACITOR_SERVER_URL = "https://ten-mien-cua-ban.com"
npm run android:sync
npm run android:apk
```

APK debug được tạo tại `android/app/build/outputs/apk/debug/app-debug.apk`.

Để phát hành chính thức lên Google Play, tạo signing key và cấu hình bản release trong Android Studio. Không commit keystore hoặc mật khẩu vào Git.

## Chạy với server local

Giá trị mặc định `http://10.0.2.2:3000` dùng được từ Android Emulator khi chạy `npm run dev` trên máy tính. Với điện thoại thật, đặt `CAPACITOR_SERVER_URL` thành IP LAN của máy tính hoặc URL HTTPS đã deploy.

## Build tự động trên GitHub

Workflow `.github/workflows/build-android.yml` dùng repository variable `CAPACITOR_SERVER_URL`. Sau mỗi lần chạy, tải artifact `hanzi-lens-debug-apk` trong trang Actions.

Khi đẩy tag dạng `v1.0.0`, workflow còn tự tạo GitHub Release và đính kèm `hanzi-lens.apk`. Đây là đường tải công khai có thể gửi cho người dùng.

```bash
git tag v1.0.0
git push origin v1.0.0
```
