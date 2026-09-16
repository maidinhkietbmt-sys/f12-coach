# F12 Coaching 🏋️‍♀️

**Fitness Web App — Giáo trình 12 tuần: Giảm mỡ · Giữ cơ · Săn chắc**

Toàn bộ app nằm trong **một file `index.html` duy nhất** — không cần cài đặt, không cần server, không cần internet sau khi tải.

## 🔗 Dùng ngay

**Mở app:** https://maidinhkietbmt-sys.github.io/f12-coach/

Hoặc tải `index.html` về máy và double-click — chạy offline 100%.

## ✨ Tính năng

- 📅 **Giáo trình 12 tuần** — 4 giai đoạn: Foundation → Build Habit → Progressive Overload → Fat Loss & Performance
- 🏋️ **3 buổi/tuần** — Buổi A (Chân & Mông) · B (Thân trên + Core) · C (Full body)
- 📖 **13 bài tập chi tiết** — hình minh họa SVG động (start → end), cue kỹ thuật, lỗi sai & cách sửa, checklist form
- ⏱️ **Workout Mode** — warm-up checklist, logging set (kg/reps/RIR), rest timer tự chạy + rung điện thoại
- 📈 **Gợi ý tăng tiến** — so sánh Last time, đề xuất tăng tạ khi đủ rep range
- 🏃 **Cardio mode** — 5 loại hình, timer, ghi chú (talk test 5–6/10)
- ⚖️ **Theo dõi** — cân nặng · vòng eo · bước chân, biểu đồ Canvas tự vẽ, trung bình tuần
- 🥗 **Dinh dưỡng** — mục tiêu kcal/protein/nước, menu mẫu, thực đơn sinh viên, tính ngân sách VND
- 🌙 **Dark mode** · 💾 lưu localStorage · 📤 xuất/nhập JSON · 🖨️ in giáo trình

## 👤 Đối tượng mặc định

Nữ · 22 tuổi · 166 cm · 63 kg — người mới tập. Toàn bộ số liệu đều chỉnh được trong app (Onboarding + Cài đặt).

> ⚠️ Ứng dụng cung cấp hướng dẫn tập luyện chung cho người trưởng thành khỏe mạnh và không thay thế tư vấn y tế.

## 🛠️ Kỹ thuật

- HTML5 + CSS3 + Vanilla JS — 1 file duy nhất, không dependency, không build
- SVG inline cho icon & hình minh họa bài tập, Canvas API cho biểu đồ
- Hash routing SPA, localStorage persistence, export/import JSON backup
