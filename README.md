# Flashcard — học từ theo lịch 7 ngày

App cho điện thoại, lấy từ vựng từ Google Sheet và chạy đúng cách học của thầy. Có 2 bản, dùng chung một mã nguồn:

- **App Android** (file APK): khi gõ đáp án, bàn phím tự chuyển sang tiếng Anh. Xem [App Android](#app-android).
- **App web (PWA)** cho iPhone và mọi máy khác.

Cách học:

1. **Học mới (1 lần):** đọc + nghe 2 lượt → chép → test mốc.
   - Chép: app chỉ hiện và đọc nghĩa tiếng Việt, bạn gõ từ tiếng Anh. Trả lời xong thì app hiện và đọc tiếng Anh. Gõ sai thì phải nghe gợi ý rồi gõ lại cho đúng.
2. **Ôn 7 ngày:** mỗi ngày 1 bài test (chọn nghĩa + gõ từ; câu sai được hỏi lại cuối bài).
3. **Được bù:** cần đủ 7 ngày có ôn, mỗi ngày tính 1 lần, trong vòng 14 ngày kể từ ngày bắt đầu. Ngày mới bắt đầu lúc 04:00.

App **chỉ đọc** các tab có sẵn trong Sheet từ vựng. Ngoại lệ duy nhất là tính năng [nhập từ PDF](#nhập-từ-pdf): nó tạo tab mới tên `[DVL] …`, và app chỉ được ghi vào những tab bắt đầu bằng `[DVL]`. Tiến độ được ghi vào một Sheet riêng ("Flashcard Progress") qua Apps Script.

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
| Tab tên bắt đầu bằng `[DVL]` | Bài nhập từ PDF, học như 1 buổi. Nằm trong mục "Nhập từ PDF" của tab Từ vựng |
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

> **Nâng cấp để dùng "Nhập từ PDF":** dán `Code.gs` mới (giữ nguyên dòng `VOCAB_SHEET_ID`) rồi triển khai **phiên bản mới** như trên. Không cần cấp thêm quyền. Nếu chưa nâng cấp, khi lưu app sẽ báo "Apps Script đang là bản cũ".

> "Bất kỳ ai" nghĩa là ai có URL cũng gọi được. Nhưng muốn đọc Sheet hay ghi tiến độ thì phải đăng nhập, và muốn tạo tài khoản thì phải có mã mời. Chỉ đưa mã mời cho người bạn tin tưởng. URL nằm sẵn trong app (công khai), còn mã mời thì không.
>
> Đổi sang Apps Script khác: sửa `API_URL` trong [src/config.ts](src/config.ts), hoặc build với `VITE_API_URL=...`.

### Nâng cấp từ bản chưa có tài khoản

1. Dán `Code.gs` mới (giữ nguyên dòng `VOCAB_SHEET_ID` của bạn).
2. Vào **Triển khai › Quản lý các lần triển khai › Sửa** → Phiên bản: **Phiên bản mới** → **Triển khai**. URL giữ nguyên.
3. Trong app, vào **Cài đặt › Tài khoản › Tạo tài khoản**. Bạn nên tạo tài khoản của mình **trước tiên**: tài khoản đầu tiên sẽ nhận toàn bộ tiến độ đã học trước đó.
4. Trên máy thứ hai, đăng nhập cùng tài khoản đó.

### Dùng chung với bạn bè

1. Gửi bạn 2 thứ: link app và mã mời (mã nhóm). Không cần gửi URL Apps Script.
2. Bạn ấy mở app → **Cài đặt** → **Tạo tài khoản** với tên, mật khẩu riêng và mã mời. Từ đó về sau, đăng nhập chỉ cần tên và mật khẩu.
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

URL Apps Script đã được cài sẵn trong app ([src/config.ts](src/config.ts)), nên người dùng không phải nhập gì về kết nối.

1. **Cài đặt:** đăng nhập. Nếu chưa có tài khoản thì bấm "Tạo tài khoản" và nhập thêm **mã mời** (mã nhóm in ra khi chạy `setup`).
3. **Cài đặt › Khai báo tiến độ cũ:** đánh dấu các buổi đã xong 7/7 và các buổi đang ôn dở (ví dụ B6 đang 5/7).
4. Trên máy thứ hai, đăng nhập cùng tài khoản. Tiến độ sẽ tự đồng bộ.

## Nhập từ PDF

Dùng cho PDF bài học có bài đọc hoặc ngữ pháp, bên dưới là danh sách từ cần nhớ (từ tiếng Anh, IPA, nghĩa tiếng Việt).

1. Mở **Từ vựng › + PDF**, hoặc **Cài đặt › Nhập từ PDF**, rồi chọn file.
2. App lấy những dòng có phiên âm IPA (`/…/` hoặc `[…]`) và bỏ qua bài đọc. Các dạng nhận được:
   - `1. abandon /əˈbændən/ (v): từ bỏ`
   - `take off (phr v) /teɪk ɒf/ - cất cánh`
   - Bảng nhiều cột (STT | Từ | Phiên âm | Loại từ | Nghĩa), kể cả khi ô bị xuống dòng.
   - Danh sách chia 2 cột.
   - Nghĩa bị xuống dòng, hoặc nằm hẳn ở dòng dưới.
3. Kiểm tra danh sách. Mỗi dòng sửa được từ, IPA, loại từ và nghĩa; có thể bỏ tick, xoá hoặc thêm từ. Dòng có nhãn "Kiểm tra lại" (không thấy nghĩa tiếng Việt) được để bỏ tick sẵn.
4. Đặt tên bài, rồi bấm **Lưu vào Sheet**. App tạo tab `[DVL] <tên bài>` (cột giống tab B), tải lại danh sách từ, và bài mới xuất hiện trong **Từ vựng › Nhập từ PDF**.
   - Nếu tên bài đã có, app hỏi trước khi ghi đè.
   - Ô A1 của tab có ghi chú ai nhập và lúc nào.

Lưu ý:
- PDF dạng ảnh scan (không bôi đen được chữ) thì chưa đọc được.
- Nếu tách sai, mở mục **Chữ đọc được từ PDF** ở cuối màn hình để xem app đọc được gì.
- Đổi prefix `[DVL]`: sửa `IMPORT_PREFIX` ở **cả** [src/config.ts](src/config.ts) và [apps-script/Code.gs](apps-script/Code.gs).

## App Android

App Android chính là app web ở trên, được đóng gói bằng [Capacitor](https://capacitorjs.com). Nó có thêm 2 thứ mà bản web không làm được:

- **Bàn phím tự đổi ngôn ngữ:**
  - Ô gõ đáp án, tên đăng nhập và cột "từ" khi nhập PDF yêu cầu bàn phím tiếng Anh.
  - Ô ghi chú quy tắc, cột "nghĩa" và tên bài yêu cầu tiếng Việt.
  - Cách hoạt động: mỗi ô khai báo `lang="en"` / `lang="vi"`. WebView của app ([LangWebView.java](android/app/src/main/java/io/github/mrl8199/flashcard/LangWebView.java)) chuyển thông tin đó cho bàn phím qua `EditorInfo.hintLocales`.
  - **Cần làm:** trong Gboard › Ngôn ngữ, bật cả *English* và *Tiếng Việt*. Gboard chỉ chuyển sang ngôn ngữ đã bật. Một số bàn phím khác (Samsung, Laban Key…) có thể bỏ qua yêu cầu này.
- **Đọc phát âm bằng giọng của máy:** WebView Android không có Web Speech, nên app dùng plugin `@capacitor-community/text-to-speech`. Muốn nghe tiếng Việt thì cài giọng Việt trong **Cài đặt máy › Chuyển văn bản thành giọng nói**.

Build APK trên máy dev (Linux/macOS/Windows). Cần **JDK 21 bản đầy đủ** (có `javac`; gói `openjdk-21-jre` là không đủ) và Android SDK:

```bash
# Cài SDK một lần (vd. vào ~/Android/Sdk) gồm: platform-tools, platforms;android-36, build-tools;36.1.0
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
export JAVA_HOME=/đường/dẫn/tới/jdk-21   # nếu java mặc định của máy không phải JDK 21 đầy đủ
npm run apk     # vite build → cap sync android → gradlew assembleDebug
# Kết quả: android/app/build/outputs/apk/debug/app-debug.apk
```

Cài lên điện thoại:
1. Chép file APK sang máy rồi mở nó (cho phép "Cài ứng dụng không rõ nguồn gốc").
2. Mở app và **đăng nhập lại** (app và trang web lưu dữ liệu riêng). Tiến độ nằm trên máy chủ nên không mất gì.

Bản cập nhật sau phải được build trên **cùng máy**, vì APK debug được ký bằng khoá `~/.android/debug.keystore` của máy đó. Nếu khoá khác, Android không cho cài đè: phải gỡ app cũ rồi cài lại (tiến độ vẫn còn trên máy chủ).

**iPhone:** chưa có app riêng. Build app iOS cần máy Mac có Xcode và Apple ID, nên hiện tại dùng bản PWA. Bản PWA vẫn nhập PDF được, nhưng không tự đổi bàn phím.

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
| [src/lib/pdfvocab.ts](src/lib/pdfvocab.ts) | Đọc PDF (pdf.js) và tách danh sách từ – IPA – nghĩa; test trong `tests/pdfvocab.test.ts`, có PDF mẫu ở `tests/fixtures/vocab-sample.pdf` |
| [src/lib/keyboard.ts](src/lib/keyboard.ts), [LangWebView.java](android/app/src/main/java/io/github/mrl8199/flashcard/LangWebView.java) | Ngôn ngữ bàn phím theo thuộc tính `lang` của ô nhập (chỉ app Android) |
| [apps-script/Code.gs](apps-script/Code.gs) | Backend: đọc Sheet, tạo tab `[DVL] …` khi nhập PDF, tài khoản (tab `NguoiDung`, mật khẩu băm SHA-256 có salt), nhật ký tiến độ theo người, email nhắc |

Tiến độ được lưu dưới dạng nhật ký sự kiện chỉ ghi thêm (bắt đầu, đọc, chép, test…), có `id` duy nhất. Hai máy gộp nhật ký theo `id` nên không bị xung đột. Mọi trạng thái (ngày mấy/7, bù, hết hạn) đều được tính lại từ nhật ký này.
