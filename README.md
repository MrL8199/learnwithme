# Flashcard — học từ theo lịch 7 ngày

App web (PWA) cho điện thoại, lấy từ vựng từ Google Sheet và chạy đúng cách học của thầy:

1. **Học mới (1 lần):** đọc + nghe 2 lượt → chép → test mốc.
   - Chép: app chỉ hiện và đọc nghĩa tiếng Việt, bạn gõ từ tiếng Anh. Trả lời xong thì app hiện và đọc tiếng Anh. Gõ sai thì phải nghe gợi ý rồi gõ lại cho đúng.
2. **Ôn 7 ngày:** mỗi ngày 1 bài test (chọn nghĩa + gõ từ; câu sai được hỏi lại cuối bài).
3. **Được bù:** cần đủ 7 ngày có ôn, mỗi ngày tính 1 lần, trong vòng 14 ngày kể từ ngày bắt đầu. Ngày mới bắt đầu lúc 04:00.

App **chỉ đọc** Sheet từ vựng. Tiến độ được ghi vào một Sheet riêng ("Flashcard Progress") qua Apps Script.

Mỗi người có **tài khoản riêng** (tên đăng nhập + mật khẩu):
- Cùng tài khoản thì tiến độ đồng bộ giữa Android và iPhone.
- Nhiều người dùng chung một Apps Script và một Sheet từ vựng, nhưng tiến độ mỗi người tách riêng.

## Sheet từ vựng được đọc thế nào

| Tab | App hiểu là |
|---|---|
| `B1`, `B2`, … (`B` + số) | Mỗi tab là 1 buổi. Cột: TỪ VỰNG, CÁCH ĐỌC, LOẠI TỪ, NGHĨA. 7 cột "Lượt" bị bỏ qua |
| Tab có cột `PHÂN LOẠI` (vd. `adj + adv`) | Ngữ pháp, mỗi nhóm PHÂN LOẠI là 1 bài |
| Tab tên chứa "to V" và "Ving" | Các nhóm cột cạnh nhau (V + To + V, V + V-ing…). Nhóm ĐẶC BIỆT là quy tắc |
| Tab có cột "Dạng nguyên mẫu" | Động từ bất quy tắc, chia 20 động từ một phần |
| Tab khác (vd. `Trang tính5`) | Bỏ qua |

Thêm buổi mới: tạo tab `B9` cùng cột như các tab cũ. App tự tải lại Sheet sau 30 phút, hoặc vào **Cài đặt › Tải lại Sheet**.

## Cài Apps Script (khoảng 5 phút, làm 1 lần)

1. Vào <https://script.google.com> → **Dự án mới**, đặt tên "Flashcard".
2. Xoá nội dung `Code.gs` có sẵn, dán toàn bộ [apps-script/Code.gs](apps-script/Code.gs).
3. Sửa dòng `VOCAB_SHEET_ID` thành ID Sheet từ vựng của bạn (phần nằm giữa `/d/` và `/edit` trong link Sheet).
4. **Cài đặt dự án** (biểu tượng bánh răng) → Múi giờ: `(GMT+07:00) Ho Chi Minh`.
5. Chọn hàm `setup` → **Chạy** → cấp quyền. Trong **Nhật ký thực thi** sẽ có dòng `MÃ NHÓM / MÃ BÍ MẬT (dán vào app): …`. Hãy lưu lại mã này.
   - `setup` tạo Sheet "Flashcard Progress" trong Drive của bạn.
6. **Triển khai › Tùy chọn triển khai mới** → loại **Ứng dụng web**:
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
   
   Sau khi triển khai, sao chép **URL ứng dụng web** (kết thúc bằng `/exec`).
7. (Tùy chọn) Chọn hàm `installReminder` → **Chạy**. Từ đó mỗi tối khoảng 21h, nếu hôm đó chưa học, bạn sẽ nhận email nhắc.

Sau khi cài xong, có thể **tắt chia sẻ link** của Sheet từ vựng, vì Apps Script đọc Sheet bằng tài khoản của bạn.

Khi sửa `Code.gs` sau này: **Triển khai › Quản lý các lần triển khai › Sửa › Phiên bản mới**. URL vẫn giữ nguyên.

> "Bất kỳ ai" nghĩa là ai có URL cũng gọi được, nhưng không có mã nhóm thì không đọc được Sheet và không tạo được tài khoản. Chỉ đưa URL và mã nhóm cho người bạn tin tưởng.

### Nâng cấp từ bản chưa có tài khoản

1. Dán `Code.gs` mới (giữ nguyên dòng `VOCAB_SHEET_ID` của bạn).
2. Vào **Triển khai › Quản lý các lần triển khai › Sửa** → Phiên bản: **Phiên bản mới** → **Triển khai**. URL giữ nguyên.
3. Trong app, vào **Cài đặt › Tài khoản › Tạo tài khoản**. Bạn nên tạo tài khoản của mình **trước tiên**: tài khoản đầu tiên sẽ nhận toàn bộ tiến độ đã học trước đó.
4. Trên máy thứ hai, đăng nhập cùng tài khoản đó.

### Dùng chung với bạn bè

1. Gửi bạn 3 thứ: link app, URL Apps Script (`/exec`), mã nhóm.
2. Bạn ấy mở app → **Cài đặt** → dán URL + mã nhóm → **Lưu & tải Sheet** → **Tạo tài khoản** với tên và mật khẩu riêng.
3. Mọi người cùng học từ một Sheet từ vựng, nhưng tiến độ hoàn toàn riêng.

Công cụ cho chủ Apps Script (chọn hàm rồi bấm **Chạy**, xem kết quả trong Nhật ký):
- `listUsers`: danh sách tài khoản và số hoạt động của từng người. Chi tiết từng hoạt động nằm trong tab `NhatKy` của Sheet "Flashcard Progress", cột `user`.
- `resetPassword`: sửa tên đăng nhập và mật khẩu mới ở 2 dòng đầu của hàm rồi chạy, dùng khi có người quên mật khẩu.
- Email nhắc 21h (`installReminder`) chỉ gửi cho chủ, tính theo tài khoản đầu tiên.

## Đưa app lên mạng (HTTPS là bắt buộc để cài lên điện thoại)

**Cách 1: GitHub Pages** (repo phải public nếu dùng gói miễn phí)

1. Tạo repo GitHub và push code lên nhánh `main`.
2. Vào repo → **Settings › Pages** → Source: **GitHub Actions**.
3. Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) sẽ tự build và đăng app tại `https://<user>.github.io/<repo>/`.

File `tests/fixtures/sheet.json` (bản export từ vựng thật) đã nằm trong `.gitignore` nên không bị đẩy lên.

**Cách 2: Cloudflare Pages / Netlify** (repo private vẫn được): chạy `npm run build` rồi kéo thả thư mục `dist/` vào trang của dịch vụ.

## Cài lên điện thoại

- **Android (Chrome):** mở link app → menu ⋮ → **Cài đặt ứng dụng** (hoặc "Thêm vào màn hình chính").
- **iPhone (Safari):** mở link app → nút Chia sẻ → **Thêm vào MH chính**.
  - Trên iPhone, app ở màn hình chính có bộ nhớ riêng, tách khỏi Safari. Vì vậy hãy cài app trước, rồi mới mở app từ màn hình chính để nhập URL và mã.

Lần đầu mở app:

1. **Cài đặt** → dán URL `/exec` và mã nhóm → **Lưu & tải Sheet**.
2. **Cài đặt › Tài khoản:** tạo tài khoản (lần đầu) hoặc đăng nhập.
3. **Cài đặt › Khai báo tiến độ cũ:** đánh dấu các buổi đã xong 7/7 và các buổi đang ôn dở (ví dụ B6 đang 5/7).
4. Trên máy thứ hai, đăng nhập cùng tài khoản. Tiến độ sẽ tự đồng bộ.

## Phát triển

```bash
npm install
npm run dev        # http://localhost:5173 ; Cài đặt › "Dùng dữ liệu mẫu (dev)" để chạy không cần Apps Script
npm test           # parser (trên Sheet thật nếu có tests/fixtures/sheet.json), chấm đáp án, bộ máy 7 ngày
npm run build
```

| File | Nội dung |
|---|---|
| [src/lib/parse.ts](src/lib/parse.ts) | Đọc các tab Sheet thành bài học (`IRREGULAR_CHUNK = 20`) |
| [src/lib/engine.ts](src/lib/engine.ts) | Quy tắc chu kỳ: `READ_TARGET = 2`, `REVIEW_DAYS = 7`, `WINDOW_DAYS = 14` |
| [src/lib/date.ts](src/lib/date.ts) | Ngày học (UTC+7, sang ngày mới lúc 04:00) |
| [src/lib/quiz.ts](src/lib/quiz.ts), [src/lib/answer.ts](src/lib/answer.ts) | Tạo câu hỏi, chấm đáp án gõ |
| [src/lib/store.ts](src/lib/store.ts) | Lưu trên máy (localStorage) + đồng bộ sự kiện với Apps Script |
| [apps-script/Code.gs](apps-script/Code.gs) | Backend: đọc Sheet, tài khoản (tab `NguoiDung`, mật khẩu băm SHA-256 có salt), nhật ký tiến độ theo người, email nhắc |

Tiến độ được lưu dưới dạng nhật ký sự kiện chỉ ghi thêm (bắt đầu, đọc, chép, test…), có `id` duy nhất. Hai máy gộp nhật ký theo `id` nên không bị xung đột. Mọi trạng thái (ngày mấy/7, bù, hết hạn) đều được tính lại từ nhật ký này.
