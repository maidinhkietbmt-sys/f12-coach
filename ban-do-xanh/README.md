# Bản đồ Xanh 🌏

Ứng dụng web/mobile cho cộng đồng **ghi nhận và theo dõi ô nhiễm môi trường** trên bản đồ mở OpenStreetMap.

## Chạy thử

Mở thẳng `index.html` bằng trình duyệt, hoặc serve thư mục này:

```bash
npx serve ban-do-xanh
# hoặc: python -m http.server -d ban-do-xanh 8000
```

> Cần internet để tải Leaflet (CDN) và tile OpenStreetMap.

## Tính năng

- 🗺️ **Bản đồ full màn hình** (Leaflet + OSM), responsive mobile → desktop, có dark mode
- 🌡️ **Chế độ xem nhiệt (heatmap)** — mật độ ô nhiễm theo vùng, trọng số theo mức độ, phím `H`
- 🚦 **Chấm màu theo mức độ khẩn cấp**: 🔴 Khẩn cấp · 🟠 Nghiêm trọng · 🟡 Cảnh báo · 🟢 Ổn định
- 🖼️ **Thẻ ảnh nhỏ hiện ngay cạnh chấm** khi nhấn (popover tự lật theo mép bản đồ) — không dùng bảng cố định dưới màn hình
- 💬 **Trang chi tiết + cộng đồng** — bình luận thảo luận và **xác nhận** báo cáo (lưu localStorage, sẵn sàng nối API)
- 📷 **Nút camera lớn ở giữa dưới**: tự lấy GPS → chọn loại ô nhiễm, mức độ, mô tả, ảnh → gửi (ảnh nén còn ~900px/JPEG 72%)
- 🔍 **Thanh tìm kiếm** + **bộ lọc** theo loại, mức độ, nguồn dữ liệu
- 📡 Tách rõ **dữ liệu người dùng** (localStorage) và **dữ liệu cảm biến** (fetch, có demo offline)
- 🧭 Nút định vị, chú thích màu gọn, phím tắt (A · L · F · H · T · / · Esc)
- ♿ Hỗ trợ chuột, cảm ứng, bàn phím: marker focus được, aria-pressed/role=radio, live region, focus restore

## Kiến trúc (tách tầng)

| File | Vai trò |
|---|---|
| `index.html` | Khung giao diện |
| `styles.css` | Design system + layout + dark mode |
| `data.js` | **Tầng dữ liệu**: `UserReports` (localStorage) · `SensorApi` (fetch) · `CommunityStore` (bình luận/xác nhận) · `DataBus` hợp nhất |
| `app.js` | Logic UI: bản đồ, marker, popover, bộ lọc, form, định vị |

### Mở rộng

- Thêm nguồn dữ liệu mới: viết module tương tự `SensorApi` trả về cùng shape `Report`, rồi merge trong `DataBus.loadAll()`.
- Gắn backend thật: đổi `ENDPOINT` trong `data.js` (`data/sensors.json` → API), dữ liệu demo tự bị thay thế.
- Mọi báo cáo đi qua `normalizeReport()` nên shape luôn nhất quán ở mọi nguồn.
