# Chức năng và cách kiểm tra

| Khu vực | Các chức năng |
| --- | --- |
| Trang chủ | Logo/tên, menu, đề cử, phim hot/mới, phim lẻ/bộ, chiếu rạp, hoạt hình, xếp hạng tuần, đánh giá cao, Xem tất cả. |
| Tìm kiếm và lọc | Gợi ý nhanh; tìm tên/từ khóa/diễn viên không dấu; thể loại, quốc gia, năm, trạng thái, mùa Anime, sắp xếp và phân trang. |
| Chi tiết | Tên Việt/gốc, poster, mô tả, metadata, điểm/lượt xem/trạng thái, yêu thích/theo dõi, tập và nguồn phát. |
| Xem phim | MP4/HLS/embed, điều khiển video trực tiếp, server/tập, tập trước/sau, phụ đề VTT, lưu vị trí và báo lỗi. |
| Tài khoản | Đăng ký/đăng nhập, hồ sơ, yêu thích, lịch sử/tiếp tục xem và theo dõi. |
| Thông báo | `/thong-bao`: phim mới, nguồn tập mới của phim theo dõi, đếm chưa đọc, tùy chọn nhận và đánh dấu đã đọc. |
| Đề xuất | `/danh-sach/de-xuat`: ưu tiên thể loại của phim yêu thích/theo dõi/đã xem; loại phim đã lưu/xem khỏi gợi ý. |
| Anime | `/danh-sach/anime`: đang phát hành, hoàn thành, mùa Xuân/Hạ/Thu/Đông do Admin nhập. |
| Cộng đồng | Bình luận, thích, sắp xếp nổi bật, ghim; một đánh giá mỗi tài khoản/phim, tính trung bình sau kiểm duyệt. |
| Nội dung | Giới thiệu, FAQ, điều khoản, quyền riêng tư, liên hệ; sitemap và RSS. |
| Admin | `/admin`: tổng quan/biểu đồ 30 ngày, CRUD phim/tập/phân loại/quốc gia, upload ảnh, đổi thứ tự tập, đánh dấu phim hot/mới/đề cử/chiếu rạp, tài khoản, bình luận, đánh giá, banner, báo lỗi và cài đặt. |

Admin được tạo tại `/dang-nhap` bằng mục Thiết lập tài khoản Admin đầu tiên. Không có mật khẩu mặc định. Xóa phim/tài khoản/bình luận/phân loại là xóa mềm có khôi phục; Admin không thể tự xóa/khóa/hạ quyền chính mình.

Thông báo là thông báo trong website, không gửi email/SMS/push bên ngoài. Danh mục ban đầu có 100 phim, không tự đồng bộ toàn bộ kho phim gốc. Các bộ lọc chưa có dữ liệu sẽ trả kết quả trống. Nguồn video phải được bổ sung đúng quyền sử dụng và có thể phụ thuộc CORS/tình trạng nhà cung cấp. Iframe không cung cấp vị trí phát cho ứng dụng; lưu vị trí áp dụng với video trực tiếp.

Dữ liệu được lưu ở `server/data.json`; cần sao lưu file này. Phiên đăng nhập hết khi khởi động lại máy chủ. JSON hiện phục vụ một máy chủ, chưa phải hệ thống cơ sở dữ liệu phân tán. Lượt xem nhập từ danh mục là số tham khảo; biểu đồ theo ngày chỉ đếm lượt phát sinh tại website.

Kiểm tra: `npm run test:server`, `npm test -- --watchAll=false --runInBand`, `npm run build`.
