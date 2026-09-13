# Quản trị website

Chạy `npm run build` rồi `npm start`. Nếu cổng 3000 đang được dùng, trong PowerShell chạy `$env:PORT='3002'; npm.cmd start`.

Vào `/admin/login` để đăng nhập hoặc thiết lập Admin đầu tiên. Trên Render, thiết lập Admin cần `ADMIN_SETUP_TOKEN` trong Environment. Không có tài khoản hay mật khẩu mặc định.

## Các trang

| URL | Chức năng |
| --- | --- |
| `/admin`, `/admin/dashboard` | Tổng phim, tập, người dùng, lượt xem, bình luận; phim mới thêm và phim xem nhiều |
| `/admin/movies` | Tìm kiếm, lọc loại/trạng thái/thể loại/quốc gia, phân trang, ẩn và thùng rác |
| `/admin/movies/create` | Thêm phim và nguồn tập |
| `/admin/movies/:id/edit` | Sửa thông tin, hình ảnh, diễn viên, đạo diễn, tập và nguồn phát |
| `/admin/episodes` | Chọn phim để thêm/sửa/xóa/sắp xếp tập, server, ngôn ngữ, đánh dấu tập mới |
| `/admin/categories`, `/admin/countries` | Thêm/sửa/xóa/khôi phục phân loại, đếm số phim |
| `/admin/users` | Tìm tài khoản, xem ngày tạo, khóa/mở khóa, xóa/khôi phục, đổi vai trò |
| `/admin/comments` | Tìm kiếm, ẩn/xóa/khôi phục/ghim bình luận; Admin có thể khóa người viết |
| `/admin/ratings` | Điểm trung bình và số đánh giá thực tế theo phim; loại/khôi phục đánh giá |
| `/admin/homepage` | Chọn phim đề cử/hot/chiếu rạp và ưu tiên các khu vực trang chủ |
| `/admin/statistics` | Hôm nay, 7 ngày, tháng này; biểu đồ 30 ngày/12 tháng và bảng dữ liệu |
| `/admin/banners`, `/admin/reports` | Quản lý banner, xử lý báo lỗi/liên hệ |
| `/admin/settings` | Tên, logo, favicon, email, footer, nội dung, bật/tắt đăng ký và bình luận |

## Quyền

- **ADMIN**: toàn bộ chức năng, bao gồm tài khoản, báo lỗi và cài đặt.
- **STAFF**: phim/tập, phân loại, banner, bình luận, đánh giá, trang chủ và thống kê. Không nhận danh sách tài khoản/email hoặc báo lỗi qua API quản trị; không đổi quyền hoặc cài đặt.
- **USER**: sử dụng website; không được truy cập API quản trị.

Backend xác minh vai trò trên từng request. Thay đổi quyền hoặc khóa/xóa tài khoản có hiệu lực với phiên đang đăng nhập. Không thể tự hạ quyền, khóa hoặc xóa tài khoản quản trị đang dùng.

## Dữ liệu thống kê

- Ngày/tháng tính theo UTC. Biểu đồ dùng lượt xem ghi nhận tại website; tổng lượt xem phim có thể chứa số liệu tham khảo từ danh mục ban đầu.
- Tổng tập đếm tập duy nhất theo tên trong mỗi phim, không nhân đôi khi cùng tập có nhiều server. Cần đặt tên tập nhất quán.
- Ngày tạo được lưu cho phim và tài khoản mới. Dữ liệu cũ không có ngày tạo được ghi rõ là chưa ghi nhận; không suy đoán từ ngày cập nhật.
- Xóa phim, tài khoản, bình luận, phân loại là xóa mềm. Đánh giá bị loại không được tính vào điểm; có thể khôi phục.
- Ở trang chủ, Đề cử/Hot/Chiếu rạp dùng phim được đánh dấu. Phim lẻ/bộ/hoạt hình và bảng xếp hạng ưu tiên phim được chọn rồi bổ sung tự động.
- Dữ liệu vẫn lưu bằng JSON (`DATA_FILE` hoặc `server/data.json`). Các cài đặt đăng ký/bình luận được backend áp dụng, không chỉ ẩn nút.

## Kiểm thử

`npm run test:server` kiểm tra API và phân quyền bằng dữ liệu tạm.

`npm test -- --watchAll=false --runInBand` kiểm tra điều hướng, bộ lọc, biểu đồ, cài đặt và giao diện người dùng.
