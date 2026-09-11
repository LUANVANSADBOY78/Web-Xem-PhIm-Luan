# Motchill — React + Node

Giao diện tham khảo từ https://motchillr.mx/, dữ liệu danh mục công khai chụp ngày 11/09/2026. Đây là dự án độc lập, không kết nối tài khoản quản trị của website gốc.

## Chạy tại máy

Mở terminal trong thư mục `movie-watching` (nơi chứa `package.json`), dùng Node.js 22:

```sh
npm install --legacy-peer-deps
npm run build
npm start
```

Truy cập http://localhost:3000. Máy chủ phục vụ cả React và `/api`, hỗ trợ tải trực tiếp các đường dẫn phim. Không mở riêng file `build/index.html` và không dùng static server vì ứng dụng cần API.

Phát triển có tự tải lại giao diện: dừng `npm start`, chạy `npm run dev` (React ở 3000, API ở 3001).

## Admin

Vào `/dang-nhap`, chọn **Thiết lập tài khoản Admin đầu tiên**, nhập tên, email và mật khẩu của bạn. Chức năng thiết lập đóng lại sau khi tạo Admin. Không có tài khoản hoặc mật khẩu mặc định. Đăng ký thông thường luôn tạo quyền User.

Admin ở `/admin`: thêm/sửa/ẩn/khôi phục phim, nhập ảnh hoặc tải poster dưới 2 MB, quản lý tập MP4/HLS/embed, phân loại, quốc gia, tài khoản, bình luận, điểm đánh giá, banner, báo lỗi và nội dung website. Thay đổi tên phân loại áp dụng lên các phim liên quan; dùng nút Xóa/Khôi phục để quản lý phân loại, kể cả phân loại chưa có phim.

## Các chức năng

- Trang chủ: phim đề cử kéo ngang, phim lẻ/bộ, chiếu rạp, hoạt hình, bảng hot và đánh giá.
- Tìm kiếm tiếng Việt có/không dấu; bộ lọc loại phim, thể loại, quốc gia, năm, trạng thái; sắp xếp, phân trang.
- Chi tiết phim, nguồn tập theo máy chủ, phát HLS/MP4/embed, chuyển tập, báo lỗi.
- Đăng ký/đăng nhập, hồ sơ, yêu thích, theo dõi, lịch sử và vị trí tiếp tục xem đối với trình phát video trực tiếp.
- Thông báo phim/tập mới, gợi ý theo yêu thích/lịch sử, Anime theo mùa, giao diện sáng/tối lưu tùy chọn.
- Bình luận có lượt thích, ghim, sắp xếp; một đánh giá mỗi người/phim, phản hồi lưu vào Admin, FAQ, nội dung giới thiệu, điều khoản, quyền riêng tư, sitemap và RSS.

## Dữ liệu và giới hạn

`server/catalog.json` là dữ liệu ban đầu. Sau thay đổi đầu tiên, dữ liệu được lưu vào `server/data.json` (đã loại khỏi Git). Sao lưu file này để giữ tài khoản và các chỉnh sửa. Đổi đường dẫn bằng biến môi trường `DATA_FILE`. Mật khẩu được băm scrypt; phiên đăng nhập nằm trong bộ nhớ, nên người dùng cần đăng nhập lại sau khi máy chủ khởi động lại.

Poster được lưu tại `public/storage/images`. Danh mục không tự đồng bộ toàn bộ kho phim của trang gốc. Nguồn video là dịch vụ bên ngoài; khả năng phát phụ thuộc tình trạng nguồn, CORS và quyền truy cập của nhà cung cấp. Có thể thay bằng nội dung được phép sử dụng trong Admin. Trình phát nhúng không cung cấp thời gian xem cho ứng dụng; chức năng tiếp tục tại vị trí cũ áp dụng cho video trực tiếp.

Thông báo trong website tại `/thong-bao` được tạo khi Admin thêm phim hoặc thêm nguồn tập cho phim đang theo dõi. Người dùng có thể tắt từng loại thông báo và đánh dấu đã đọc. Chưa tích hợp email/push ngoài website. Dữ liệu tham khảo lượt xem/điểm từ danh mục được giữ riêng với đánh giá mới của người dùng. JSON phù hợp chạy một máy chủ/đồ án; chưa phải cơ sở dữ liệu dành cho nhiều máy chủ đồng thời.

## Kiểm tra

```sh
npm run test:server
npm test -- --watchAll=false --runInBand
npm run build
```

Kiểm thử bao gồm phân quyền, thiết lập Admin một lần, CRUD phim, ẩn/khôi phục, bình luận, đánh giá, lịch sử, khóa tài khoản, tìm kiếm và màn hình lỗi API.

## Triển khai Render

[Deploy to Render](https://render.com/deploy?repo=https://github.com/LUANVANSADBOY78/Web-Xem-PhIm-Luan)

Dùng liên kết trên để Render đọc `render.yaml` và tạo **Web Service Node**. Trang Static Site không chạy được API đăng nhập và quản trị.

Cấu hình: nhánh `main`, Root Directory để trống, Build Command `npm ci --legacy-peer-deps && npm run build`, Start Command `npm start`, Node 22.19.0, HOST `0.0.0.0`. Health check ở `/api/health`.

Blueprint hiện dùng gói **Free**, không tạo tài nguyên trả phí. File `/tmp/van-luan-data.json` là lưu trữ tạm: tài khoản và chỉnh sửa mất sau khi Render khởi động lại hoặc triển khai lại. Muốn giữ dữ liệu cần ổ persistent disk trên gói hỗ trợ disk hoặc cơ sở dữ liệu ngoài. Docker vẫn hỗ trợ gắn volume `/data`.

Lần đầu tạo Admin trên Render: mở service → Environment, lấy giá trị `ADMIN_SETUP_TOKEN` do Render sinh; vào website `/dang-nhap` → Thiết lập Admin, nhập mã đó cùng tài khoản mới. Không gửi mã lên GitHub. Mã này ngăn người lạ giành quyền Admin đầu tiên khi website vừa được công khai. Nếu tạo service thủ công, cần tự đặt biến `ADMIN_SETUP_TOKEN` trước khi thiết lập Admin.

Xem bảng đối chiếu yêu cầu và đường dẫn chức năng trong [FEATURES.md](FEATURES.md). Thao tác Xóa phim/tài khoản/bình luận sử dụng xóa mềm để có thể khôi phục.
