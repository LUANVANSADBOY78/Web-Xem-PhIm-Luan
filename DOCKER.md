# 🐳 Hướng Dẫn Chạy Ứng Dụng Xem Phim Bằng Docker & Docker Compose

Tài liệu hướng dẫn đóng gói và triển khai ứng dụng **Web Xem Phim Văn Luân** sử dụng **Docker** và **Docker Compose**.

---

## 🛠️ 1. Yêu Cầu Tiền Đề

- Đã cài đặt [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) hoặc [Docker Engine](https://docs.docker.com/engine/install/) (Linux).
- Đã cài đặt [Docker Compose](https://docs.docker.com/compose/install/) (đi kèm mặc định trong Docker Desktop).

---

## 🚀 2. Khởi Chạy Nhanh Bằng Docker Compose (Khuyên Dùng)

Chỉ cần 1 lệnh duy nhất để build ứng dụng React, chạy Node.js server và tự động lưu trữ dữ liệu database:

```bash
docker compose up -d --build
```

Sau khi lệnh chạy hoàn tất:
- Truy cập website tại: **`http://localhost:3000`**
- Trang quản trị Admin tại: **`http://localhost:3000/admin`**
  - **Email**: `admin@gmail.com`
  - **Mật khẩu**: `admin123456`

---

## 📋 3. Lệnh Quản Lý Thường Dùng

### Xem nhật ký hoạt động (Logs):
```bash
docker compose logs -f
```

### Kiểm tra trạng thái container:
```bash
docker compose ps
```

### Dừng ứng dụng:
```bash
docker compose down
```

---

## 📦 4. Build & Run Thủ Công Bằng Docker CLI

### Build Docker Image:
```bash
docker build -t web-xem-phim-luan .
```

### Chạy Container:
```bash
docker run -d \
  --name web-xem-phim \
  -p 3000:3000 \
  -v movie_data:/data \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  -e ADMIN_SETUP_TOKEN=vanluanadmin \
  web-xem-phim-luan
```

---

## 💾 5. Dữ Liệu Persistent (Volume)

Dữ liệu phim, người dùng, bình luận và cấu hình được tự động lưu trong Docker Volume `movie_data` tại `/data/data.json`.
Ngay cả khi bạn dừng hoặc xóa container, dữ liệu phim và tài khoản Admin sẽ **không bị mất**.
