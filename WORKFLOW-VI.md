# WorkSpace — Kế Hoạch Dự Án Chi Tiết

> Tài liệu này là nguồn thông tin duy nhất và chính xác nhất cho toàn bộ dự án.
> Cả lập trình viên và AI đều phải đọc file này trước khi bắt đầu làm bất kỳ công việc nào.
> Cập nhật lần cuối: 04-11-2026

---

## Mục Lục

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Công Nghệ Sử Dụng & Lý Do](#2-công-nghệ-sử-dụng--lý-do)
3. [Kiến Trúc Hệ Thống](#3-kiến-trúc-hệ-thống)
4. [Thiết Kế Cơ Sở Dữ Liệu](#4-thiết-kế-cơ-sở-dữ-liệu)
5. [Thiết Kế API](#5-thiết-kế-api)
6. [Đặc Tả Tính Năng](#6-đặc-tả-tính-năng)
7. [Các Giai Đoạn & Thời Gian](#7-các-giai-đoạn--thời-gian)
8. [Kế Hoạch Triển Khai](#8-kế-hoạch-triển-khai)
9. [Hướng Dẫn Làm Việc](#9-hướng-dẫn-làm-việc)
10. [Danh Sách File Tham Khảo](#10-danh-sách-file-tham-khảo)
11. [Giải Thích Thuật Ngữ](#11-giải-thích-thuật-ngữ)

---

## 1. Tổng Quan Dự Án

### WorkSpace là gì?

WorkSpace là một **nền tảng cộng tác SaaS đa người thuê** (multi-tenant SaaS) nơi các nhóm có thể:
- Tạo các không gian làm việc (workspace) riêng biệt cho tổ chức của họ
- Giao tiếp theo thời gian thực qua các kênh trò chuyện (channels)
- Quản lý công việc trên bảng Kanban
- Chia sẻ file và nhận thông báo

Hãy tưởng tượng nó như phiên bản đơn giản hóa của Slack + Trello gộp lại thành một ứng dụng.

### Tại sao chọn dự án này?

Dự án này chứng minh cho nhà tuyển dụng rằng lập trình viên:
- Có khả năng xây dựng ứng dụng SaaS sẵn sàng cho production
- Hiểu về multi-tenancy và cách cô lập dữ liệu
- Có thể triển khai tính năng thời gian thực (real-time)
- Nắm vững xác thực (authentication), phân quyền (authorization) và bảo mật
- Có thể triển khai (deploy) và duy trì ứng dụng đang chạy thực tế
- Viết code sạch, có kiểm thử (test), có tài liệu đi kèm

### Đối tượng nhà tuyển dụng mục tiêu

- Công ty tuyển **lập trình viên NestJS / Node.js backend**
- Công ty tuyển **lập trình viên fullstack TypeScript**
- Công ty đang xây dựng **sản phẩm SaaS**

---

## 2. Công Nghệ Sử Dụng & Lý Do

### Backend (Phần máy chủ)

| Công nghệ | Mục đích | Lý do chọn |
|---|---|---|
| **NestJS** | Framework API | Kiến trúc module rõ ràng, DI tích hợp sẵn, TypeScript là ngôn ngữ chính, mẫu thiết kế giống Angular/ASP.NET — thể hiện tư duy kiến trúc tốt |
| **TypeScript** | Ngôn ngữ lập trình | An toàn về kiểu dữ liệu, trải nghiệm lập trình tốt hơn, bắt lỗi lúc biên dịch |
| **PostgreSQL** | Cơ sở dữ liệu chính | Mạnh mẽ, hỗ trợ truy vấn phức tạp, phù hợp cho multi-tenant với lọc theo hàng |
| **Prisma** | ORM (công cụ tương tác database) | Truy vấn an toàn kiểu, hệ thống migration tuyệt vời, dùng dễ hơn TypeORM |
| **Redis** | Bộ nhớ đệm + hàng đợi | Lưu trữ trong bộ nhớ nhanh, dùng cho caching, session, và hàng đợi công việc Bull |
| **Bull** | Xử lý công việc nền | Xử lý job đáng tin cậy, có cơ chế thử lại, dựa trên Redis |
| **Socket.io** | Thời gian thực | WebSocket với cơ chế dự phòng, nhắn tin theo phòng, hỗ trợ nhiều trình duyệt |
| **Passport.js** | Xác thực người dùng | Tiêu chuẩn ngành cho xác thực Node.js, chiến lược JWT |
| **Zod** | Kiểm tra dữ liệu đầu vào | Kiểm tra kiểu lúc chạy, ưu tiên schema, nghiêm ngặt hơn class-validator |
| **Cloudinary** | Lưu trữ file | Gói miễn phí hào phóng, biến đổi ảnh tích hợp, dễ dùng hơn S3 cho dự án portfolio |
| **Nodemailer** | Gửi email | Đơn giản, hoạt động với mọi nhà cung cấp SMTP |

### Frontend (Phần giao diện người dùng)

| Công nghệ | Mục đích | Lý do chọn |
|---|---|---|
| **React 18+** | Framework giao diện | Tiêu chuẩn ngành, hệ sinh thái lớn, lập trình viên đã biết sử dụng |
| **Vite** | Công cụ build | HMR nhanh, cấu hình đơn giản, trải nghiệm tốt hơn CRA |
| **TypeScript** | Ngôn ngữ | Nhất quán với backend, an toàn kiểu |
| **TanStack Query** | Quản lý state từ server | Caching, refetch tự động, cập nhật lạc quan — quản lý state API đúng cách |
| **Zustand** | Quản lý state phía client | Nhẹ, API đơn giản, không cần boilerplate như Redux |
| **Socket.io-client** | Thời gian thực | Khớp với Socket.io phía backend |
| **dnd-kit** | Kéo và thả | Hiện đại, hỗ trợ accessibility, nhẹ — dùng cho bảng Kanban |
| **Tailwind CSS** | Tạo kiểu giao diện | Tiếp cận utility-first, phát triển nhanh, thiết kế nhất quán |
| **React Hook Form + Zod** | Xử lý form | Hiệu suất cao (không render lại không cần thiết), schema Zod dùng chung với backend |
| **React Router v6** | Điều hướng trang | Tiêu chuẩn cho React SPA |

### DevOps & Hạ tầng

| Công nghệ | Mục đích | Lý do chọn |
|---|---|---|
| **Docker** | Đóng gói ứng dụng | Môi trường nhất quán, triển khai dễ dàng |
| **Docker Compose** | Phát triển cục bộ | Một lệnh để khởi động toàn bộ dịch vụ |
| **GitHub Actions** | CI/CD (tự động kiểm tra và triển khai) | Miễn phí cho repo công khai, tích hợp với GitHub |
| **Render.com** | Host backend | Gói miễn phí, hỗ trợ Docker, tự động deploy từ GitHub |
| **Vercel** | Host frontend | Miễn phí, tối ưu cho React/Vite, deploy tức thì |
| **Neon** | Host PostgreSQL | Gói miễn phí 0.5GB, PostgreSQL serverless |
| **Upstash** | Host Redis | Gói miễn phí 10K lệnh/ngày, Redis serverless |

---

## 3. Kiến Trúc Hệ Thống

### Kiến trúc tổng thể

```
┌─────────────┐     HTTPS      ┌──────────────────────────────────┐
│             │ ──────────────► │         MÁY CHỦ BACKEND         │
│   REACT     │   REST API      │         (NestJS)                 │
│   (Vite)    │                 │                                  │
│             │ ◄─────────────► │  ┌─────────┐  ┌──────────────┐  │
│  Vercel     │   Socket.io     │  │ Guards   │  │ Controllers  │  │
│             │                 │  │ & Pipes  │──│ (Bộ điều     │  │
└─────────────┘                 │  └─────────┘  │  khiển)      │  │
                                │               └──────┬───────┘  │
                                │                      │          │
                                │               ┌──────▼───────┐  │
                                │               │  Services    │  │
                                │               │  (Logic      │  │
                                │               │   nghiệp vụ) │  │
                                │               └──────┬───────┘  │
                                │                      │          │
                                │               ┌──────▼───────┐  │
                                │               │ Repositories │  │
                                │               │ (Truy vấn    │  │
                                │               │  database)   │  │
                                │               └──────┬───────┘  │
                                │  Render.com          │          │
                                └──────────────────────┼──────────┘
                                                       │
                          ┌────────────────────────────┼────────────────┐
                          │                            │                │
                   ┌──────▼───────┐           ┌───────▼──────┐  ┌──────▼──────┐
                   │ PostgreSQL   │           │    Redis     │  │ Cloudinary  │
                   │ (Neon)       │           │  (Upstash)   │  │ (Files)     │
                   │              │           │              │  │             │
                   │ - Users      │           │ - Cache      │  │ - Hình ảnh  │
                   │ - Workspaces │           │ - Sessions   │  │ - Tài liệu  │
                   │ - Messages   │           │ - Hàng đợi   │  │ - Avatar    │
                   │ - Tasks      │           │ - Pub/Sub    │  │             │
                   └──────────────┘           └──────────────┘  └─────────────┘
```

### Luồng xử lý Request (mỗi yêu cầu từ client đi qua các bước sau)

```
Yêu cầu từ Client (trình duyệt)
     │
     ▼
[Middleware toàn cục]      → Ghi log, CORS, nén dữ liệu, giới hạn tần suất
     │
     ▼
[Auth Guard]               → Xác minh JWT token, lấy thông tin người dùng
     │
     ▼
[Workspace Guard]          → Xác minh người dùng thuộc workspace, lấy vai trò
     │
     ▼
[Validation Pipe]          → Kiểm tra dữ liệu đầu vào bằng Zod
     │
     ▼
[Controller]               → Phân tích yêu cầu, gọi service
     │
     ▼
[Service]                  → Xử lý logic nghiệp vụ, gọi repository
     │
     ▼
[Repository]               → Truy vấn database (luôn lọc theo workspaceId)
     │
     ▼
[Response Interceptor]     → Chuyển đổi phản hồi sang định dạng chuẩn
     │
     ▼
Phản hồi về Client
```

### Kiến trúc thời gian thực (WebSocket)

```
Client kết nối → Socket.io bắt tay → JWT được xác minh
     │
     ▼
Client tham gia phòng → phòng "workspace:{workspaceId}"
     │
     ▼
Khi có sự kiện xảy ra (tin nhắn mới, cập nhật task):
  1. Service xử lý hành động
  2. Service phát sự kiện đến WebSocket Gateway
  3. Gateway phát sóng đến phòng
  4. Tất cả client đang kết nối trong workspace đó nhận được cập nhật
```

### Luồng công việc nền (Background Job)

```
Service tạo công việc → Hàng đợi Bull (Redis)
     │
     ▼
Bull Worker nhận công việc → xử lý nó
     │
     ├── Gửi email qua Nodemailer
     ├── Tạo thông báo + phát sự kiện WebSocket
     └── Dọn dẹp: xóa lời mời hết hạn, thông báo cũ
```

---

## 4. Thiết Kế Cơ Sở Dữ Liệu

### Sơ đồ quan hệ giữa các bảng

```
users (Người dùng) ────────┐
  │                         │
  │ (một → nhiều)           │ (một → nhiều)
  │                         │
  ▼                         ▼
workspace_members          invitations
(Thành viên WS)            (Lời mời)
  │                         │
  │ (nhiều → một)           │ (nhiều → một)
  │                         │
  ▼                         ▼
workspaces (Không gian LV) ┘
  │
  │ (một → nhiều)
  ├──────────────────────────────┐
  │                              │
  ▼                              ▼
channels (Kênh chat)           boards (Bảng công việc)
  │                              │
  │ (một → nhiều)                │ (một → nhiều)
  │                              │
  ├── channel_members            ├── board_columns (Cột)
  │   (Thành viên kênh)         │     │
  ▼                              │     │ (một → nhiều)
messages (Tin nhắn)              │     ▼
  │                              │   tasks (Công việc)
  │ (một → nhiều)                │
  ▼                              │
message_attachments              │
(File đính kèm)                 │
                                 │
notifications (Thông báo) ◄─────┘ (tham chiếu đa hình)
```

### Định nghĩa chi tiết từng bảng

#### users (Bảng người dùng)
```
id            UUID        KHÓA CHÍNH, tự sinh UUID
email         VARCHAR     DUY NHẤT, KHÔNG ĐƯỢC NULL
password      VARCHAR     KHÔNG ĐƯỢC NULL (đã mã hóa bằng bcrypt)
fullName      VARCHAR     KHÔNG ĐƯỢC NULL
avatarUrl     VARCHAR     CÓ THỂ NULL (ảnh đại diện)
isActive      BOOLEAN     MẶC ĐỊNH true
lastLoginAt   TIMESTAMP   CÓ THỂ NULL (lần đăng nhập cuối)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại
updatedAt     TIMESTAMP   TỰ ĐỘNG CẬP NHẬT
```

#### workspaces (Bảng không gian làm việc)
```
id            UUID        KHÓA CHÍNH
name          VARCHAR     KHÔNG ĐƯỢC NULL, tối đa 100 ký tự
slug          VARCHAR     DUY NHẤT, KHÔNG ĐƯỢC NULL (phiên bản URL thân thiện của tên)
description   VARCHAR     CÓ THỂ NULL, tối đa 500 ký tự
logoUrl       VARCHAR     CÓ THỂ NULL
ownerId       UUID        KHÓA NGOẠI → users.id, KHÔNG ĐƯỢC NULL
deletedAt     TIMESTAMP   CÓ THỂ NULL (xóa mềm — đánh dấu xóa thay vì xóa thật)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại
updatedAt     TIMESTAMP   TỰ ĐỘNG CẬP NHẬT

INDEX (chỉ mục tìm kiếm nhanh): slug, ownerId
```

#### workspace_members (Bảng thành viên workspace)
```
id            UUID        KHÓA CHÍNH
workspaceId   UUID        KHÓA NGOẠI → workspaces.id
userId        UUID        KHÓA NGOẠI → users.id
role          ENUM        'OWNER' | 'ADMIN' | 'MEMBER', MẶC ĐỊNH 'MEMBER'
joinedAt      TIMESTAMP   MẶC ĐỊNH thời gian hiện tại

RÀNG BUỘC DUY NHẤT: (workspaceId, userId) — một user chỉ có 1 bản ghi trong 1 workspace
INDEX: workspaceId, userId
```

#### channels (Bảng kênh trò chuyện)
```
id            UUID        KHÓA CHÍNH
workspaceId   UUID        KHÓA NGOẠI → workspaces.id
name          VARCHAR     KHÔNG ĐƯỢC NULL, tối đa 80 ký tự
description   VARCHAR     CÓ THỂ NULL, tối đa 300 ký tự
type          ENUM        'PUBLIC' (ai cũng tham gia được) | 'PRIVATE' (phải được mời)
createdById   UUID        KHÓA NGOẠI → users.id
deletedAt     TIMESTAMP   CÓ THỂ NULL (xóa mềm)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại
updatedAt     TIMESTAMP   TỰ ĐỘNG CẬP NHẬT

RÀNG BUỘC DUY NHẤT: (workspaceId, name) — không được trùng tên kênh trong cùng workspace
INDEX: workspaceId
```

#### channel_members (Bảng thành viên kênh)
```
id            UUID        KHÓA CHÍNH
channelId     UUID        KHÓA NGOẠI → channels.id
userId        UUID        KHÓA NGOẠI → users.id
lastReadAt    TIMESTAMP   CÓ THỂ NULL (để đếm tin nhắn chưa đọc)
joinedAt      TIMESTAMP   MẶC ĐỊNH thời gian hiện tại

RÀNG BUỘC DUY NHẤT: (channelId, userId)
INDEX: channelId, userId
```

#### messages (Bảng tin nhắn)
```
id            UUID        KHÓA CHÍNH
channelId     UUID        KHÓA NGOẠI → channels.id
senderId      UUID        KHÓA NGOẠI → users.id (người gửi)
content       TEXT        KHÔNG ĐƯỢC NULL (nội dung tin nhắn)
parentId      UUID        KHÓA NGOẠI → messages.id, CÓ THỂ NULL (để trả lời tin nhắn — thread)
isEdited      BOOLEAN     MẶC ĐỊNH false (đã chỉnh sửa chưa)
deletedAt     TIMESTAMP   CÓ THỂ NULL (xóa mềm)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại
updatedAt     TIMESTAMP   TỰ ĐỘNG CẬP NHẬT

INDEX: (channelId, createdAt) — tổ hợp, để tải tin nhắn theo trang
INDEX: parentId — để truy vấn thread
```

#### message_attachments (Bảng file đính kèm tin nhắn)
```
id            UUID        KHÓA CHÍNH
messageId     UUID        KHÓA NGOẠI → messages.id
fileUrl       VARCHAR     KHÔNG ĐƯỢC NULL (đường dẫn file trên cloud)
fileName      VARCHAR     KHÔNG ĐƯỢC NULL (tên file gốc)
fileSize      INTEGER     KHÔNG ĐƯỢC NULL (kích thước tính bằng bytes)
mimeType      VARCHAR     KHÔNG ĐƯỢC NULL (loại file: image/png, application/pdf,...)

INDEX: messageId
```

#### boards (Bảng công việc — Kanban board)
```
id            UUID        KHÓA CHÍNH
workspaceId   UUID        KHÓA NGOẠI → workspaces.id
name          VARCHAR     KHÔNG ĐƯỢC NULL, tối đa 100 ký tự
createdById   UUID        KHÓA NGOẠI → users.id
deletedAt     TIMESTAMP   CÓ THỂ NULL (xóa mềm)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại
updatedAt     TIMESTAMP   TỰ ĐỘNG CẬP NHẬT

INDEX: workspaceId
```

#### board_columns (Bảng cột trong board)
```
id            UUID        KHÓA CHÍNH
boardId       UUID        KHÓA NGOẠI → boards.id
name          VARCHAR     KHÔNG ĐƯỢC NULL, tối đa 50 ký tự (VD: "Cần làm", "Đang làm", "Hoàn thành")
position      INTEGER     KHÔNG ĐƯỢC NULL (thứ tự hiển thị: 0, 1, 2...)
color         VARCHAR     CÓ THỂ NULL (màu hiển thị dạng hex: #FF5733)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại

INDEX: (boardId, position) — tổ hợp
```

#### tasks (Bảng công việc)
```
id            UUID        KHÓA CHÍNH
columnId      UUID        KHÓA NGOẠI → board_columns.id (task thuộc cột nào)
title         VARCHAR     KHÔNG ĐƯỢC NULL, tối đa 200 ký tự
description   TEXT        CÓ THỂ NULL (mô tả chi tiết)
priority      ENUM        'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', MẶC ĐỊNH 'MEDIUM'
dueDate       TIMESTAMP   CÓ THỂ NULL (hạn hoàn thành)
position      INTEGER     KHÔNG ĐƯỢC NULL (thứ tự trong cột — dùng cho kéo thả)
assigneeId    UUID        KHÓA NGOẠI → users.id, CÓ THỂ NULL (người được giao)
createdById   UUID        KHÓA NGOẠI → users.id (người tạo)
completedAt   TIMESTAMP   CÓ THỂ NULL (thời điểm hoàn thành)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại
updatedAt     TIMESTAMP   TỰ ĐỘNG CẬP NHẬT

INDEX: (columnId, position) — tổ hợp
INDEX: assigneeId — tìm task theo người được giao
INDEX: dueDate — cho truy vấn nhắc nhở deadline
```

#### invitations (Bảng lời mời)
```
id            UUID        KHÓA CHÍNH
workspaceId   UUID        KHÓA NGOẠI → workspaces.id
email         VARCHAR     KHÔNG ĐƯỢC NULL (email người được mời)
role          ENUM        'ADMIN' | 'MEMBER', MẶC ĐỊNH 'MEMBER'
token         VARCHAR     DUY NHẤT, KHÔNG ĐƯỢC NULL (chuỗi ngẫu nhiên cho link mời)
status        ENUM        'PENDING' (chờ) | 'ACCEPTED' (đã chấp nhận) | 'EXPIRED' (hết hạn)
invitedById   UUID        KHÓA NGOẠI → users.id (người mời)
expiresAt     TIMESTAMP   KHÔNG ĐƯỢC NULL (mặc định: 7 ngày kể từ khi tạo)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại

RÀNG BUỘC DUY NHẤT: (workspaceId, email) — không mời cùng email 2 lần vào cùng workspace
INDEX: token — để tra cứu khi chấp nhận lời mời
INDEX: expiresAt — cho công việc dọn dẹp tự động
```

#### notifications (Bảng thông báo)
```
id              UUID        KHÓA CHÍNH
userId          UUID        KHÓA NGOẠI → users.id (ai nhận thông báo)
type            ENUM        'TASK_ASSIGNED' (được giao task)
                            | 'TASK_DUE_SOON' (task sắp đến hạn)
                            | 'MESSAGE_MENTION' (được nhắc đến trong tin nhắn)
                            | 'INVITATION_RECEIVED' (nhận lời mời)
                            | 'MEMBER_JOINED' (thành viên mới tham gia)
title           VARCHAR     KHÔNG ĐƯỢC NULL
content         VARCHAR     CÓ THỂ NULL
referenceId     UUID        CÓ THỂ NULL (ID của đối tượng liên quan)
referenceType   ENUM        'TASK' | 'MESSAGE' | 'INVITATION' | 'WORKSPACE'
workspaceId     UUID        KHÓA NGOẠI → workspaces.id (để nhóm theo workspace)
isRead          BOOLEAN     MẶC ĐỊNH false (đã đọc chưa)
createdAt       TIMESTAMP   MẶC ĐỊNH thời gian hiện tại

INDEX: (userId, isRead, createdAt) — tổ hợp, cho truy vấn "thông báo chưa đọc"
```

#### refresh_tokens (Bảng token làm mới)
```
id            UUID        KHÓA CHÍNH
userId        UUID        KHÓA NGOẠI → users.id
token         VARCHAR     DUY NHẤT, KHÔNG ĐƯỢC NULL (đã mã hóa)
expiresAt     TIMESTAMP   KHÔNG ĐƯỢC NULL (thời điểm hết hạn)
createdAt     TIMESTAMP   MẶC ĐỊNH thời gian hiện tại

INDEX: userId, token, expiresAt
```

---

## 5. Thiết Kế API

### Định dạng phản hồi chuẩn

```json
// Thành công (một đối tượng)
{
  "success": true,
  "data": { ... }
}

// Thành công (danh sách có phân trang)
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,        // tổng số bản ghi
    "page": 1,           // trang hiện tại
    "limit": 20,         // số bản ghi mỗi trang
    "totalPages": 5      // tổng số trang
  }
}

// Lỗi
{
  "success": false,
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Thông báo lỗi dễ đọc",
  "details": [
    { "field": "email", "message": "Email không đúng định dạng" }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Danh sách toàn bộ Endpoint

#### Module Xác Thực — `/api/v1/auth`
```
POST   /register              Đăng ký tài khoản mới
POST   /login                 Đăng nhập, trả về access token + refresh token
POST   /refresh               Làm mới access token bằng refresh token
POST   /logout                Vô hiệu hóa refresh token (đăng xuất)
POST   /forgot-password       Gửi email đặt lại mật khẩu
POST   /reset-password        Đặt lại mật khẩu bằng token
GET    /me                    Lấy thông tin người dùng hiện tại
```

#### Module Người Dùng — `/api/v1/users`
```
PATCH  /profile               Cập nhật thông tin cá nhân
PATCH  /avatar                Tải lên/thay đổi ảnh đại diện
PATCH  /password              Đổi mật khẩu (cần nhập mật khẩu hiện tại)
```

#### Module Workspace — `/api/v1/workspaces`
```
GET    /                      Liệt kê các workspace mà user thuộc về
POST   /                      Tạo workspace mới
GET    /:workspaceId          Xem chi tiết workspace
PATCH  /:workspaceId          Cập nhật workspace (chỉ OWNER, ADMIN)
DELETE /:workspaceId          Xóa mềm workspace (chỉ OWNER)
```

#### Thành Viên Workspace — `/api/v1/workspaces/:workspaceId/members`
```
GET    /                      Liệt kê thành viên workspace
PATCH  /:memberId/role        Thay đổi vai trò thành viên (chỉ OWNER, ADMIN)
DELETE /:memberId             Xóa thành viên (chỉ OWNER, ADMIN)
POST   /leave                 Rời workspace (OWNER không được rời)
```

#### Lời Mời — `/api/v1/workspaces/:workspaceId/invitations`
```
GET    /                      Liệt kê lời mời đang chờ (ADMIN trở lên)
POST   /                      Mời thành viên qua email (ADMIN trở lên)
DELETE /:invitationId         Hủy lời mời (ADMIN trở lên)
POST   /accept/:token         Chấp nhận lời mời (công khai, không cần workspace guard)
```

#### Kênh Chat — `/api/v1/workspaces/:workspaceId/channels`
```
GET    /                      Liệt kê kênh trong workspace
POST   /                      Tạo kênh mới
GET    /:channelId            Xem chi tiết kênh
PATCH  /:channelId            Cập nhật kênh
DELETE /:channelId            Xóa mềm kênh (ADMIN trở lên)
POST   /:channelId/join       Tham gia kênh công khai
POST   /:channelId/leave      Rời kênh
GET    /:channelId/members    Liệt kê thành viên kênh
```

#### Tin Nhắn — `/api/v1/workspaces/:workspaceId/channels/:channelId/messages`
```
GET    /                      Liệt kê tin nhắn (phân trang theo con trỏ)
POST   /                      Gửi tin nhắn
PATCH  /:messageId            Sửa tin nhắn (chỉ người gửi)
DELETE /:messageId             Xóa mềm tin nhắn (người gửi hoặc ADMIN)
GET    /:messageId/thread     Lấy các phản hồi trong thread
```

#### Bảng Công Việc — `/api/v1/workspaces/:workspaceId/boards`
```
GET    /                      Liệt kê boards trong workspace
POST   /                      Tạo board mới
GET    /:boardId              Xem board kèm cột và tasks
PATCH  /:boardId              Cập nhật tên board
DELETE /:boardId              Xóa mềm board (ADMIN trở lên)
```

#### Cột Board — `/api/v1/workspaces/:workspaceId/boards/:boardId/columns`
```
POST   /                      Tạo cột mới
PATCH  /:columnId             Cập nhật cột (tên, màu)
DELETE /:columnId             Xóa cột (phải trống hoặc di chuyển tasks)
PATCH  /reorder               Sắp xếp lại cột (gửi mảng { id, position })
```

#### Công Việc — `/api/v1/workspaces/:workspaceId/boards/:boardId/tasks`
```
GET    /                      Liệt kê tasks (lọc theo cột, người giao, ưu tiên, hạn)
POST   /                      Tạo task mới
GET    /:taskId               Xem chi tiết task
PATCH  /:taskId               Cập nhật task
DELETE /:taskId               Xóa task
PATCH  /:taskId/move          Di chuyển task sang cột khác + vị trí mới (kéo thả)
PATCH  /:taskId/assign        Giao/bỏ giao thành viên
```

#### Thông Báo — `/api/v1/notifications`
```
GET    /                      Liệt kê thông báo của user hiện tại (phân trang)
GET    /unread-count          Lấy số thông báo chưa đọc
PATCH  /:notificationId/read  Đánh dấu đã đọc
PATCH  /read-all              Đánh dấu tất cả đã đọc
```

#### Tải File — `/api/v1/uploads`
```
POST   /image                 Tải ảnh lên (avatar, logo workspace)
POST   /file                  Tải file lên (file đính kèm tin nhắn)
```

### Sự kiện WebSocket

```
// Client gửi lên Server
socket.emit('join-workspace', { workspaceId })      // Tham gia phòng workspace
socket.emit('leave-workspace', { workspaceId })      // Rời phòng workspace
socket.emit('join-channel', { channelId })           // Tham gia phòng channel
socket.emit('leave-channel', { channelId })          // Rời phòng channel
socket.emit('typing', { channelId, userId })         // Đang gõ...
socket.emit('stop-typing', { channelId, userId })    // Ngừng gõ

// Server gửi về Client
socket.on('new-message', { message, channelId })               // Tin nhắn mới
socket.on('message-updated', { message, channelId })           // Tin nhắn được sửa
socket.on('message-deleted', { messageId, channelId })         // Tin nhắn bị xóa
socket.on('user-typing', { channelId, userId, fullName })      // Ai đó đang gõ
socket.on('user-stop-typing', { channelId, userId })           // Ai đó ngừng gõ
socket.on('task-updated', { task, boardId })                   // Task được cập nhật
socket.on('task-moved', { taskId, fromColumnId, toColumnId })  // Task được di chuyển
socket.on('member-joined', { workspaceId, user })              // Thành viên mới
socket.on('member-left', { workspaceId, userId })              // Thành viên rời đi
socket.on('notification', { notification })                     // Thông báo mới
```

---

## 6. Đặc Tả Tính Năng

### Tính năng 1: Xác Thực (Authentication)

**Đăng ký**
- Đầu vào: email, password, fullName
- Kiểm tra: email đúng định dạng, password tối thiểu 8 ký tự (1 chữ hoa, 1 số)
- Kiểm tra email chưa được đăng ký
- Mã hóa password bằng bcrypt (salt rounds: 10)
- Tạo bản ghi user trong database
- Tạo JWT access token (hết hạn sau 15 phút) + refresh token (hết hạn sau 7 ngày)
- Lưu refresh token đã mã hóa vào database
- Trả về tokens + thông tin user (KHÔNG bao gồm password)

**Đăng nhập**
- Đầu vào: email, password
- Tìm user theo email
- So sánh password với bcrypt
- Nếu đúng: tạo cặp token mới, lưu refresh token
- Nếu sai: trả về lỗi 401 — KHÔNG nói "sai mật khẩu", phải nói "thông tin đăng nhập không hợp lệ" (để tránh kẻ tấn công biết email nào tồn tại)

**Làm mới Token (Token Refresh)**
- Đầu vào: refresh token (từ httpOnly cookie)
- Tìm token trong database
- Nếu không tìm thấy hoặc hết hạn: trả về lỗi 401
- Nếu tìm thấy: xóa token cũ, tạo cặp token mới, lưu refresh token mới
- Cơ chế này gọi là "xoay vòng refresh token" — ngăn chặn tấn công tái sử dụng token

**Đăng xuất**
- Xóa refresh token khỏi database
- Client xóa access token khỏi bộ nhớ

### Tính năng 2: Workspaces (Không gian làm việc)

**Tạo Workspace**
- Đầu vào: name (tên), slug (tùy chọn — tự tạo từ tên nếu không cung cấp)
- Kiểm tra slug thân thiện URL (chữ thường, chữ số + gạch ngang)
- Kiểm tra slug chưa bị trùng
- Tạo workspace
- Tạo bản ghi workspace_member với vai trò OWNER cho người tạo
- Tự động tạo kênh "general"

**Workspace Guard (chạy trước mọi request liên quan đến workspace)**
```
1. Lấy workspaceId từ URL
2. Tìm workspace_member với workspaceId + userId
3. Nếu không tìm thấy → trả về 403 Forbidden (Cấm truy cập)
4. Gắn workspaceId và vai trò thành viên vào request
5. Tất cả truy vấn tiếp theo sử dụng workspaceId này
```

### Tính năng 3: Kênh Chat & Tin Nhắn

**Gửi tin nhắn**
- Xác minh người dùng là thành viên của kênh
- Tạo bản ghi tin nhắn
- Nếu có file đính kèm: tải file lên, tạo bản ghi attachment
- Phát sự kiện 'new-message' qua WebSocket đến phòng kênh
- Tạo thông báo cho những người được @mention (phân tích nội dung tin nhắn)

**Tải tin nhắn (phân trang theo con trỏ — cursor-based)**
```
GET /messages?cursor=<lastMessageId>&limit=20

Tại sao dùng cursor thay vì offset?
- Phân trang offset bị lỗi khi có tin nhắn mới (các mục bị dịch chuyển)
- Phân trang cursor ổn định — luôn tải tin nhắn trước/sau một điểm cố định
- Hiệu suất tốt hơn trên tập dữ liệu lớn (không cần quét OFFSET)
```

**Chỉ báo đang gõ (Typing Indicator)**
- Client gửi sự kiện 'typing' khi user bắt đầu gõ
- Server phát sóng đến phòng kênh
- Client gửi 'stop-typing' sau 3 giây không gõ
- Server tự xóa trạng thái typing sau 5 giây (phòng trường hợp client mất kết nối)

### Tính năng 4: Bảng Kanban

**Kéo thả — Quản lý vị trí**
```
Khi task di chuyển từ Cột A vị trí 2 → Cột B vị trí 1:

1. Cập nhật task được di chuyển: columnId = B, position = 1
2. Các task trong Cột B có position >= 1: tăng position lên 1
3. Các task trong Cột A có position > 2: giảm position đi 1
4. Tất cả trong một giao dịch database duy nhất (transaction)

Phương pháp khoảng cách (gap-based positioning — đơn giản hơn):
- Thay vì 0, 1, 2, 3 thì dùng 1000, 2000, 3000, 4000
- Di chuyển giữa 2000 và 3000 → đặt position = 2500
- Chỉ cân bằng lại khi khoảng cách quá nhỏ (< 1)
- Ít cập nhật database hơn mỗi lần di chuyển
```

**Giao việc (Task Assignment)**
- Khi giao task cho user, xác minh user là thành viên workspace
- Tạo thông báo cho người được giao
- Nếu task có dueDate (hạn chót), lên lịch công việc nhắc nhở

### Tính năng 5: Thông Báo

**Các loại và khi nào kích hoạt**
```
TASK_ASSIGNED       → khi ai đó giao task cho bạn
TASK_DUE_SOON       → 24 giờ trước hạn chót (công việc nền)
MESSAGE_MENTION     → khi ai đó @nhắc bạn trong tin nhắn
INVITATION_RECEIVED → khi bạn được mời vào workspace
MEMBER_JOINED       → khi ai đó tham gia workspace (thông báo cho admin)
```

**Cách gửi**
- Trong ứng dụng: tạo bản ghi thông báo + phát sự kiện WebSocket
- Email: cho INVITATION_RECEIVED và TASK_DUE_SOON (qua công việc nền)

---

## 7. Các Giai Đoạn & Thời Gian

### Giai đoạn 1: Nền tảng + Xác thực (Tuần 1–2)

**Mục tiêu**: Người dùng có thể đăng ký, đăng nhập và quản lý hồ sơ cá nhân.

**Danh sách công việc**:
```
1.1  Khởi tạo dự án NestJS với TypeScript strict mode
1.2  Thiết lập Docker Compose: PostgreSQL + Redis
1.3  Thiết lập Prisma với schema ban đầu (users + refresh_tokens)
1.4  Tạo module cấu hình với kiểm tra biến môi trường bằng Zod
1.5  Tạo bộ lọc lỗi toàn cục (global exception filter)
1.6  Tạo bộ chặn phản hồi (response interceptor) cho định dạng chuẩn
1.7  Tạo Zod validation pipe
1.8  Triển khai module xác thực:
     - POST /register (đăng ký)
     - POST /login (đăng nhập)
     - POST /refresh (làm mới token)
     - POST /logout (đăng xuất)
     - GET  /me (lấy thông tin cá nhân)
1.9  Triển khai module người dùng:
     - PATCH /profile (cập nhật hồ sơ)
     - PATCH /password (đổi mật khẩu)
1.10 Viết unit test cho auth service
1.11 Viết integration test cho các endpoint xác thực
1.12 Thiết lập tài liệu Swagger
```

**Tiêu chí hoàn thành**:
- [ ] Đăng ký, đăng nhập, làm mới token, đăng xuất hoạt động
- [ ] Thông tin đăng nhập sai trả về lỗi đúng
- [ ] Refresh token xoay vòng đúng cách
- [ ] Endpoint được bảo vệ trả về 401 khi không có token
- [ ] Tất cả test đều pass
- [ ] Tài liệu Swagger truy cập được tại /api/docs

---

### Giai đoạn 2: Workspace & Thành viên (Tuần 3)

**Mục tiêu**: Người dùng có thể tạo workspace, mời thành viên, quản lý vai trò.

**Danh sách công việc**:
```
2.1  Thêm Prisma schema: workspaces, workspace_members, invitations
2.2  Tạo WorkspaceGuard
2.3  Tạo decorator @CurrentWorkspace() và @WorkspaceRole()
2.4  Triển khai module workspace:
     - Các endpoint CRUD
     - Tự động tạo kênh "general" khi tạo workspace
2.5  Triển khai module thành viên workspace:
     - Liệt kê, đổi vai trò, xóa, rời
2.6  Triển khai module lời mời:
     - Tạo lời mời + gửi email
     - Chấp nhận lời mời (bằng token)
     - Hủy lời mời
     - Công việc nền: làm hết hạn lời mời cũ
2.7  Viết test cho workspace service (đặc biệt kiểm tra cô lập dữ liệu đa tenant)
2.8  Viết integration test: user A không thể truy cập workspace B
```

**Tiêu chí hoàn thành**:
- [ ] Tạo workspace được, tự động tạo slug
- [ ] Mời qua email, chấp nhận lời mời qua link
- [ ] Phân quyền theo vai trò hoạt động (OWNER > ADMIN > MEMBER)
- [ ] User không thể truy cập workspace không thuộc về mình
- [ ] Test cô lập dữ liệu pass
- [ ] Lời mời hết hạn sau 7 ngày

---

### Giai đoạn 3: Kênh Chat & Tin Nhắn (Tuần 4–5)

**Mục tiêu**: Người dùng có thể chat thời gian thực trong các kênh workspace.

**Danh sách công việc**:
```
3.1  Thêm Prisma schema: channels, channel_members, messages, message_attachments
3.2  Triển khai module kênh:
     - CRUD + tham gia/rời
     - Kênh công khai: bất kỳ thành viên workspace nào cũng tham gia được
     - Kênh riêng tư: phải được mời
3.3  Triển khai module tin nhắn:
     - CRUD với phân trang cursor
     - Trả lời theo thread (parentId)
     - Sửa và xóa mềm tin nhắn của mình
3.4  Thiết lập WebSocket Gateway:
     - Xác thực JWT khi bắt tay (handshake)
     - Quản lý phòng (workspace rooms, channel rooms)
     - Phát sự kiện khi có tin nhắn mới, sửa, xóa
3.5  Triển khai chỉ báo đang gõ (typing indicator)
3.6  Thiết lập module tải file (Cloudinary):
     - Tải ảnh (avatar, logo workspace)
     - Tải file (đính kèm tin nhắn)
     - Kiểm tra kích thước file và loại file
3.7  Viết test cho message service
3.8  Viết test tích hợp WebSocket
```

**Tiêu chí hoàn thành**:
- [ ] Tạo kênh, gửi tin nhắn được
- [ ] Tin nhắn tải với phân trang cursor
- [ ] Thời gian thực: tin nhắn xuất hiện ngay cho tất cả thành viên kênh
- [ ] Trả lời thread hoạt động
- [ ] Tải file hoạt động với kiểm tra kích thước/loại
- [ ] Chỉ báo đang gõ hiện/ẩn đúng
- [ ] WebSocket yêu cầu xác thực

---

### Giai đoạn 4: Bảng Kanban (Tuần 6–7)

**Mục tiêu**: Người dùng có thể quản lý công việc bằng bảng Kanban kéo thả.

**Danh sách công việc**:
```
4.1  Thêm Prisma schema: boards, board_columns, tasks
4.2  Triển khai module board:
     - CRUD
     - Tự động tạo cột mặc định (Cần làm, Đang làm, Hoàn thành)
4.3  Triển khai module cột:
     - CRUD + sắp xếp lại thứ tự
4.4  Triển khai module task:
     - CRUD
     - Di chuyển task giữa các cột (quản lý vị trí)
     - Giao/bỏ giao thành viên
     - Lọc theo người giao, ưu tiên, hạn chót
4.5  Cập nhật task thời gian thực qua WebSocket
4.6  Viết test cho logic di chuyển/sắp xếp task
```

**Tiêu chí hoàn thành**:
- [ ] Tạo board với các cột mặc định
- [ ] Tạo, sửa, xóa task
- [ ] Kéo thả di chuyển task giữa các cột
- [ ] Sắp xếp lại cột hoạt động
- [ ] Giao task thông báo cho người được giao
- [ ] Bộ lọc hoạt động đúng
- [ ] Cập nhật thời gian thực cho tất cả người xem board

---

### Giai đoạn 5: Thông Báo & Công Việc Nền (Tuần 8)

**Mục tiêu**: Người dùng nhận thông báo thời gian thực và qua email.

**Danh sách công việc**:
```
5.1  Thêm Prisma schema: notifications
5.2  Triển khai module thông báo:
     - Liệt kê với phân trang
     - Đếm chưa đọc
     - Đánh dấu đã đọc / đánh dấu tất cả đã đọc
5.3  Tạo notification service (được dùng bởi các module khác):
     - createNotification(userId, type, data)
     - Lưu vào DB + phát sự kiện WebSocket
5.4  Thiết lập hàng đợi Bull:
     - Hàng đợi email: gửi email mời, nhắc deadline
     - Hàng đợi dọn dẹp: hết hạn lời mời, xóa thông báo cũ
5.5  Triển khai công việc định kỳ (cron):
     - Mỗi giờ: kiểm tra task đến hạn trong 24 giờ → gửi nhắc nhở
     - Mỗi ngày: hết hạn lời mời chờ quá 7 ngày
5.6  Viết test cho notification service
5.7  Viết test cho công việc nền
```

**Tiêu chí hoàn thành**:
- [ ] Thông báo xuất hiện thời gian thực
- [ ] Badge số chưa đọc cập nhật
- [ ] Email gửi được cho lời mời
- [ ] Nhắc nhở deadline gửi 24 giờ trước hạn
- [ ] Lời mời hết hạn được dọn dẹp tự động

---

### Giai đoạn 6: Giao Diện Frontend (Tuần 9–11)

**Mục tiêu**: Giao diện React hoàn chỉnh kết nối với toàn bộ tính năng backend.

**Danh sách công việc**:
```
6.1  Khởi tạo dự án React + Vite + TypeScript
6.2  Thiết lập Tailwind CSS + hệ thống thiết kế cơ bản (màu sắc, khoảng cách, font chữ)
6.3  Thiết lập React Router với cấu trúc layout:
     - Layout công khai (đăng nhập, đăng ký, chấp nhận lời mời)
     - Layout bảng điều khiển (thanh bên, header, nội dung chính)
6.4  Thiết lập TanStack Query + Axios với interceptors:
     - Tự động gắn JWT vào request
     - Tự động làm mới token khi nhận 401
     - Xử lý lỗi toàn cục
6.5  Thiết lập Zustand stores:
     - AuthStore (user, tokens)
     - WorkspaceStore (workspace hiện tại, thành viên)
     - NotificationStore (số chưa đọc)
6.6  Thiết lập Socket.io client:
     - Kết nối khi đăng nhập, ngắt kết nối khi đăng xuất
     - Tham gia phòng workspace khi chuyển workspace
6.7  Triển khai các trang:
     - Xác thực: Đăng nhập, Đăng ký, Quên mật khẩu
     - Workspace: Danh sách, Tạo mới, Cài đặt
     - Kênh: Danh sách bên trái, Khung tin nhắn, Panel thread
     - Board: Giao diện Kanban với kéo thả
     - Thông báo: Dropdown + trang đầy đủ
     - Hồ sơ: Sửa hồ sơ, Đổi mật khẩu
6.8  Triển khai tính năng thời gian thực:
     - Tin nhắn mới xuất hiện tức thì
     - Chỉ báo đang gõ
     - Cập nhật bảng task
     - Badge thông báo
6.9  Thiết kế responsive (thân thiện di động)
6.10 Trạng thái loading, trạng thái trống, trạng thái lỗi cho tất cả trang
```

**Tiêu chí hoàn thành**:
- [ ] Tất cả trang hoạt động và kết nối backend
- [ ] Tính năng thời gian thực hoạt động
- [ ] Làm mới token hoạt động trong suốt (user không nhận ra)
- [ ] Responsive trên di động
- [ ] Không có lỗi console
- [ ] Tất cả trạng thái được xử lý (loading, empty, error)

---

### Giai đoạn 7: Kiểm Thử & Hoàn Thiện (Tuần 12)

**Mục tiêu**: Chất lượng code sẵn sàng cho production.

**Danh sách công việc**:
```
7.1  Backend: đảm bảo tất cả unit test pass
7.2  Backend: đảm bảo tất cả integration test pass
7.3  Backend: thêm test cho các trường hợp biên (edge cases)
7.4  Frontend: thêm test cho các component quan trọng (tùy chọn nhưng tốt)
7.5  Tài liệu API hoàn chỉnh trong Swagger
7.6  Script seed data: tạo workspace demo với dữ liệu mẫu
7.7  Giới hạn tần suất (rate limiting) trên tất cả endpoint
7.8  Kiểm tra bảo mật:
     - Kiểm tra tất cả endpoint có auth guard
     - Kiểm tra tất cả truy vấn lọc theo workspaceId
     - Kiểm tra không có dữ liệu nhạy cảm trong phản hồi
     - Kiểm tra thông báo lỗi không lộ thông tin nội bộ
7.9  Kiểm tra hiệu suất:
     - Không có truy vấn N+1 (kiểm tra Prisma logs)
     - Index trên các cột thường xuyên truy vấn
     - Thời gian phản hồi dưới 200ms cho endpoint thông dụng
```

---

### Giai đoạn 8: Triển Khai & Tài Liệu (Tuần 13)

**Mục tiêu**: Ứng dụng chạy thực tế, truy cập được qua URL.

**Danh sách công việc**:
```
8.1  Tạo Dockerfile production (multi-stage build)
8.2  Thiết lập biến môi trường cho production
8.3  Triển khai PostgreSQL trên Neon
8.4  Triển khai Redis trên Upstash
8.5  Triển khai backend trên Render.com:
     - Kết nối với GitHub repo
     - Cài đặt biến môi trường
     - Endpoint kiểm tra sức khỏe (health check)
8.6  Triển khai frontend trên Vercel:
     - Kết nối với GitHub repo
     - Cài đặt biến môi trường (URL API)
8.7  Thiết lập GitHub Actions:
     - Khi push lên main: kiểm tra cú pháp → kiểm tra kiểu → test → triển khai
8.8  Thiết lập ping giữ hoạt động cho Render free tier
8.9  Viết README.md:
     - Mô tả dự án với ảnh chụp màn hình/GIF
     - Link demo trực tiếp
     - Công nghệ sử dụng kèm giải thích ngắn
     - Sơ đồ kiến trúc
     - Hướng dẫn chạy cục bộ (docker-compose up)
     - Hướng dẫn chạy test
     - Link tài liệu API
     - Giải thích các quyết định kỹ thuật
8.10 Tạo seed data để demo luôn có nội dung mẫu
8.11 Kiểm tra lần cuối trên URL production
```

**Tiêu chí hoàn thành**:
- [ ] Backend chạy và phản hồi tại URL Render
- [ ] Frontend chạy và hoạt động tại URL Vercel
- [ ] Đăng ký, tạo workspace, chat, quản lý task trên bản live
- [ ] README hoàn chỉnh với ảnh chụp
- [ ] docker-compose up hoạt động cho phát triển cục bộ
- [ ] Pipeline CI/CD pass

---

## 8. Kế Hoạch Triển Khai

### Phát triển cục bộ

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: workspace
      POSTGRES_PASSWORD: workspace123
      POSTGRES_DB: workspace_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://workspace:workspace123@postgres:5432/workspace_dev
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret-thay-doi-khi-len-production
      # ... các biến khác
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend/src:/app/src  # tải lại nóng khi thay đổi code

volumes:
  postgres_data:
```

### Kiến trúc Production

```
Push code lên GitHub
     │
     ▼
GitHub Actions ──── Kiểm tra cú pháp + Kiểm tra kiểu + Chạy Test
     │
     ├── Backend pass → Tự động triển khai lên Render.com
     │                   └── Kết nối Neon (PostgreSQL)
     │                   └── Kết nối Upstash (Redis)
     │                   └── Kết nối Cloudinary (Files)
     │
     └── Frontend pass → Tự động triển khai lên Vercel
                          └── Kết nối URL backend trên Render
```

### Biến môi trường Production

```
# Backend (.env.production)
NODE_ENV=production
PORT=3000

# Cơ sở dữ liệu
DATABASE_URL=postgresql://user:pass@neon-host/workspace_prod?sslmode=require

# Redis
REDIS_URL=rediss://default:pass@upstash-host:6379

# JWT
JWT_ACCESS_SECRET=<chuỗi-ngẫu-nhiên-64-ký-tự>
JWT_REFRESH_SECRET=<chuỗi-ngẫu-nhiên-khác-64-ký-tự>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Email (dùng Gmail SMTP hoặc Resend miễn phí)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx

# URL Frontend (cho CORS)
FRONTEND_URL=https://workspace-app.vercel.app

# URL Backend (cho link trong email)
BACKEND_URL=https://workspace-api.onrender.com
```

### Giới hạn gói miễn phí cần biết

```
Neon (PostgreSQL):     0.5 GB lưu trữ, tự ngủ sau 5 phút không hoạt động
Upstash (Redis):       10,000 lệnh/ngày, 256 MB lưu trữ
Render (Backend):      Tắt sau 15 phút không dùng, 750 giờ/tháng
Vercel (Frontend):     100 GB băng thông/tháng, triển khai không giới hạn
Cloudinary (Files):    25 GB lưu trữ, 25 GB băng thông/tháng
```

### Xử lý khi server ngủ (Free Tier Sleep)

Render free tier đưa server vào chế độ ngủ sau 15 phút không hoạt động. Request đầu tiên sau khi ngủ mất khoảng 30 giây (khởi động lạnh — cold start).

Cách xử lý:
1. **Ghi chú trong README**: "Lần tải đầu tiên có thể mất 30 giây do hosting miễn phí cần khởi động lại"
2. **Thiết lập cron ping**: dùng dịch vụ miễn phí như UptimeRobot để ping health endpoint mỗi 14 phút
3. **Health endpoint**: GET /api/v1/health trả về { status: 'ok', timestamp: ... }

---

## 9. Hướng Dẫn Làm Việc

### Dành cho lập trình viên

```
1. Chọn một giai đoạn (milestone)
2. Đọc danh sách công việc của giai đoạn đó
3. Cho từng công việc:
   a. Viết prompt rõ ràng mô tả bạn cần gì
   b. Kèm theo ngữ cảnh: module nào, file nào đã có, đã làm đến đâu
   c. Kiểm tra code được tạo ra so với RULE.md
   d. Test thủ công
   e. Commit với message có ý nghĩa
4. Khi giai đoạn hoàn thành, review lại toàn bộ code một lần nữa
5. Chuyển sang giai đoạn tiếp theo
```

### Dành cho AI

```
Trước khi tạo BẤT KỲ code nào:
1. Đọc RULE.md — tuân thủ nghiêm ngặt tất cả quy tắc
2. Đọc WORKFLOW.md này — hiểu toàn bộ ngữ cảnh
3. Kiểm tra đang làm giai đoạn nào
4. Kiểm tra những gì đã tồn tại (hỏi nếu không chắc)
5. Tạo code phải:
   - Tuân theo cấu trúc folder trong RULE.md
   - Sử dụng công nghệ đã định nghĩa trong tài liệu này
   - Tuân theo mẫu thiết kế API đã định nghĩa
   - Có xử lý lỗi đúng cách
   - Có kiểu TypeScript đúng
   - Sẵn sàng để lập trình viên review và commit

Khi được yêu cầu triển khai tính năng:
1. Bắt đầu với thay đổi Prisma schema (nếu có)
2. Rồi tầng repository
3. Rồi tầng service (với logic nghiệp vụ)
4. Rồi DTOs với kiểm tra Zod
5. Rồi controller
6. Rồi tests
7. Luôn giải thích đã xây gì và tại sao

Khi được yêu cầu sửa lỗi:
1. Xác định nguyên nhân gốc trước
2. Giải thích tại sao lỗi xảy ra
3. Sửa nó
4. Thêm test để bắt được lỗi này
```

### Mẫu Prompt cho các công việc thường gặp

**Triển khai tính năng mới:**
```
Triển khai tính năng [tên tính năng] cho giai đoạn [N].

Ngữ cảnh:
- Module hiện tại: [tên module]
- File liên quan đã có: [danh sách]
- Bảng database liên quan: [danh sách]

Yêu cầu:
- [Sao chép task từ phần giai đoạn]

Tuân theo RULE.md và WORKFLOW.md.
```

**Thêm endpoint mới:**
```
Thêm endpoint [HTTP_METHOD] [đường dẫn endpoint].

Endpoint này phải:
- [Chức năng]
- [Quy tắc kiểm tra dữ liệu]
- [Ai được truy cập — vai trò nào]
- [Trả về gì]

Prisma model liên quan: [tên model]
Tuân theo mẫu Controller → Service → Repository từ RULE.md.
```

**Sửa lỗi:**
```
Lỗi: [Mô tả vấn đề]
Mong đợi: [Điều lẽ ra phải xảy ra]
Thực tế: [Điều thực sự xảy ra]

File liên quan:
- [đường dẫn file]

Tìm nguyên nhân gốc, sửa lỗi, và thêm test.
```

---

## 10. Danh Sách File Tham Khảo

```
WORKFLOW.md          ← File này (kế hoạch dự án, bạn đang ở đây)
WORKFLOW-VI.md       ← Phiên bản tiếng Việt
RULE.md              ← Quy tắc và tiêu chuẩn code
README.md            ← Tài liệu công khai của dự án (tạo ở giai đoạn 8)
.env.example         ← Mẫu biến môi trường
docker-compose.yml   ← Thiết lập phát triển cục bộ
```

---

## 11. Giải Thích Thuật Ngữ

### Khái niệm kiến trúc

**Multi-tenant (Đa người thuê)**
Một ứng dụng phục vụ nhiều nhóm/tổ chức khác nhau, nhưng dữ liệu của mỗi nhóm hoàn toàn tách biệt. Giống như một tòa chung cư — mỗi căn hộ (workspace) có khóa riêng, cư dân (user) chỉ vào được căn hộ của mình, dù tất cả đều ở chung một tòa nhà (ứng dụng).

**SaaS (Software as a Service — Phần mềm dưới dạng dịch vụ)**
Mô hình kinh doanh phần mềm qua internet. Thay vì mua phần mềm cài đặt, người dùng truy cập qua trình duyệt và trả phí theo tháng. Ví dụ: Slack, Trello, Google Workspace, Notion.

**REST API**
Cách giao tiếp giữa frontend và backend qua HTTP. Frontend gửi request (yêu cầu) đến một URL cụ thể, backend xử lý và trả về response (phản hồi). Giống như gọi món ở nhà hàng — bạn (frontend) gọi món (request), bồi bàn mang đến nhà bếp (backend), nhà bếp nấu xong mang ra (response).

**WebSocket**
Kênh giao tiếp hai chiều liên tục giữa client và server. Khác với REST (hỏi mới trả lời), WebSocket cho phép server chủ động gửi dữ liệu đến client bất cứ lúc nào. Giống như cuộc gọi điện thoại — hai bên nói chuyện liên tục, không cần gác máy rồi gọi lại.

**Middleware**
Code chạy ở giữa, trước khi request đến controller. Giống như bảo vệ ở cổng tòa nhà — kiểm tra thẻ ra vào (auth), ghi sổ ra vào (logging), kiểm tra xem có mang vũ khí không (validation).

**Pipeline**
Chuỗi các bước xử lý nối tiếp nhau. Request đi qua từng bước: middleware → guard → pipe → controller → service → repository. Giống như dây chuyền sản xuất — mỗi trạm làm một việc.

### Xác thực & Bảo mật

**JWT (JSON Web Token)**
Một "thẻ ra vào" kỹ thuật số. Sau khi đăng nhập, server tạo một token (chuỗi ký tự dài) chứa thông tin user. Client gửi token này kèm mọi request để chứng minh "tôi đã đăng nhập". Token có thời hạn và không thể giả mạo.

**Access Token**
Token ngắn hạn (15 phút) dùng để truy cập API. Hết hạn nhanh để giảm rủi ro nếu bị đánh cắp.

**Refresh Token**
Token dài hạn (7 ngày) dùng để xin access token mới khi token cũ hết hạn. Được lưu an toàn hơn (httpOnly cookie — JavaScript không đọc được).

**Refresh Token Rotation (Xoay vòng token)**
Mỗi lần dùng refresh token, hệ thống phát hành cặp token hoàn toàn mới và hủy cái cũ. Nếu kẻ tấn công đánh cắp refresh token cũ, nó đã bị vô hiệu hóa rồi.

**bcrypt**
Thuật toán mã hóa password một chiều. Biến "mypassword123" thành chuỗi như "$2b$10$N9qo8uLOickgx2ZMRZoMye..." Không thể giải mã ngược lại. Khi đăng nhập, hệ thống mã hóa password bạn nhập rồi so sánh với chuỗi đã lưu.

**httpOnly Cookie**
Cookie mà JavaScript không thể đọc được — chỉ trình duyệt tự động gửi kèm request. An toàn hơn localStorage vì kẻ tấn công không thể đánh cắp qua XSS (tấn công qua mã JavaScript độc).

**CORS (Cross-Origin Resource Sharing)**
Cơ chế cho phép frontend (chạy trên vercel.app) gọi API backend (chạy trên render.com). Mặc định trình duyệt chặn request đến domain khác. CORS cho phép backend nói "tôi chấp nhận request từ domain này".

**Rate Limiting (Giới hạn tần suất)**
Giới hạn số request mỗi user có thể gửi trong một khoảng thời gian. Ví dụ: tối đa 100 request/phút. Ngăn chặn tấn công DDoS và lạm dụng API.

**Soft Delete (Xóa mềm)**
Thay vì xóa dữ liệu thật sự khỏi database, chỉ đánh dấu `deletedAt = thời gian hiện tại`. Dữ liệu vẫn còn nhưng không hiển thị cho user. Lợi ích: có thể khôi phục, giữ lại lịch sử, tránh phá vỡ liên kết giữa các bảng.

### Cơ sở dữ liệu

**UUID (Universally Unique Identifier)**
Chuỗi ID dạng `550e8400-e29b-41d4-a716-446655440000`. Không thể đoán được, khác với ID tự tăng (1, 2, 3...) nơi kẻ tấn công có thể đoán ID tiếp theo. An toàn hơn cho API công khai.

**Khóa chính (Primary Key)**
Cột duy nhất xác định mỗi bản ghi trong bảng. Không được trùng, không được NULL. Giống số CMND — mỗi người một số duy nhất.

**Khóa ngoại (Foreign Key — FK)**
Cột trong bảng này tham chiếu đến khóa chính của bảng khác, tạo mối liên kết. `workspace_members.userId → users.id` nghĩa là cột userId trong bảng workspace_members trỏ đến cột id trong bảng users.

**Index (Chỉ mục)**
Cấu trúc giúp database tìm kiếm nhanh hơn. Giống như mục lục cuối sách — thay vì đọc từng trang để tìm chủ đề, bạn tra mục lục. Đặt index trên cột hay tìm kiếm (email, workspaceId). Nhược điểm: tốn thêm dung lượng và chậm hơn khi ghi dữ liệu.

**Migration**
File ghi lại thay đổi cấu trúc database theo thời gian. Thêm bảng mới? Tạo migration. Thêm cột? Tạo migration. Giống như lịch sử git nhưng cho database. Cho phép đồng bộ cấu trúc DB giữa các máy và môi trường.

**ORM (Object-Relational Mapping)**
Công cụ cho phép bạn tương tác với database bằng code thay vì viết SQL trực tiếp. `prisma.user.findMany()` thay vì `SELECT * FROM users`. Prisma là ORM chúng ta dùng.

**N+1 Query (Truy vấn N+1)**
Lỗi hiệu suất phổ biến. Ví dụ: lấy 100 user (1 query), rồi cho mỗi user lấy tasks (100 query nữa) = 101 query. Đúng ra chỉ cần 1-2 query với JOIN hoặc include. Giống như gọi điện hỏi từng học sinh điểm thi, thay vì lấy cả bảng điểm một lần.

**Transaction (Giao dịch)**
Nhóm nhiều thao tác database thành một "gói". Hoặc tất cả thành công, hoặc tất cả hủy bỏ. Ví dụ: chuyển tiền — trừ tiền người gửi VÀ cộng tiền người nhận phải xảy ra cùng lúc. Nếu một bước thất bại, hoàn tác tất cả.

### Kiến trúc ứng dụng

**Controller (Bộ điều khiển)**
Lớp nhận request từ client, gọi service xử lý, rồi trả response. KHÔNG chứa logic nghiệp vụ. Giống lễ tân — nhận yêu cầu từ khách, chuyển cho bộ phận phù hợp, rồi trả kết quả.

**Service (Dịch vụ)**
Lớp chứa TẤT CẢ logic nghiệp vụ. "Nếu user đã tồn tại thì báo lỗi", "Nếu workspace đầy thì không cho thêm thành viên". Giống bộ phận xử lý — quyết định làm gì với yêu cầu.

**Repository (Kho dữ liệu)**
Lớp CHỈ tương tác với database. Viết query, đọc/ghi dữ liệu. Giống thủ kho — chỉ lo việc lấy hàng và cất hàng, không quan tâm hàng dùng để làm gì.

**DTO (Data Transfer Object — Đối tượng truyền dữ liệu)**
Đối tượng định nghĩa dữ liệu đầu vào (request) và đầu ra (response). Giống form đăng ký — quy định cần điền gì, format ra sao. `CreateUserDto` quy định cần email, password, fullName. `UserResponseDto` quy định trả về id, email, fullName (KHÔNG trả password).

**Guard (Lính gác)**
Code kiểm tra quyền trước khi request đến controller. `AuthGuard` kiểm tra đã đăng nhập chưa. `WorkspaceGuard` kiểm tra có thuộc workspace không. `RoleGuard` kiểm tra có đủ quyền không (ADMIN trở lên).

**Decorator**
Nhãn đặc biệt gắn lên class, method, hoặc parameter để thêm hành vi. `@Controller()`, `@Get()`, `@UseGuards()` là các decorator. Giống như dán nhãn lên hộp — nhìn nhãn biết bên trong là gì và xử lý thế nào.

### Frontend

**SPA (Single Page Application)**
Ứng dụng web chỉ tải một trang HTML duy nhất, sau đó JavaScript xử lý mọi thứ — chuyển trang, tải dữ liệu, cập nhật giao diện — mà không cần tải lại trang. React, Vue, Angular đều tạo SPA.

**State (Trạng thái)**
Dữ liệu thay đổi trong ứng dụng. "User đang đăng nhập" là state. "Danh sách tin nhắn" là state. "Form đang nhập dở" là state. Quản lý state tốt = ứng dụng chạy mượt.

**Server State vs Client State**
Server state: dữ liệu từ server (danh sách user, tin nhắn...) — dùng TanStack Query quản lý.
Client state: dữ liệu chỉ tồn tại ở trình duyệt (sidebar đang mở/đóng, modal đang hiển thị...) — dùng Zustand quản lý.

**HMR (Hot Module Replacement)**
Khi bạn sửa code, trình duyệt tự cập nhật NGAY mà không cần tải lại trang. Vite làm việc này rất nhanh.

### DevOps

**Docker**
Công cụ "đóng gói" ứng dụng cùng mọi thứ nó cần (OS, thư viện, cấu hình) vào một "container". Container chạy giống nhau trên mọi máy. Giống như shipping container — bên trong chứa đủ thứ, vận chuyển đi đâu cũng chạy được.

**Docker Compose**
Công cụ chạy nhiều container cùng lúc. Một lệnh `docker-compose up` khởi động backend + PostgreSQL + Redis. Thay vì phải cài và cấu hình từng thứ.

**CI/CD (Continuous Integration / Continuous Deployment)**
CI: mỗi khi push code, tự động chạy lint (kiểm tra style) → test → build. Nếu có lỗi, báo ngay.
CD: nếu CI pass, tự động triển khai lên server production. Không cần deploy thủ công.

**Cold Start (Khởi động lạnh)**
Khi server đã ngủ (free tier), request đầu tiên phải chờ server thức dậy. Mất 10-30 giây. Các request sau đó nhanh bình thường.

**Seed Data (Dữ liệu mẫu)**
Script tạo dữ liệu mẫu trong database để demo. Thay vì nhà tuyển dụng vào thấy trống trơn, họ thấy workspace có sẵn kênh chat, tin nhắn, task board... trông chuyên nghiệp hơn.

### Performance

**Caching (Bộ nhớ đệm)**
Lưu kết quả truy vấn vào Redis (bộ nhớ nhanh) để lần sau không cần hỏi database. Ví dụ: thông tin workspace ít thay đổi → cache 5 phút. Giống như bạn photo trang sách hay xem — lần sau không cần mở sách ra nữa.

**Cursor-based Pagination (Phân trang theo con trỏ)**
Thay vì nói "lấy trang 5" (offset), nói "lấy 20 tin nhắn SAU tin nhắn ID này" (cursor). Ổn định hơn khi có dữ liệu mới liên tục (tin nhắn chat). Offset bị lỗi vì khi có tin mới, tất cả trang bị dịch chuyển.

**Background Job (Công việc nền)**
Công việc xử lý ở hậu trường, không làm chậm response cho user. Ví dụ: gửi email mất 2-3 giây. Thay vì bắt user chờ, ta đưa việc gửi email vào hàng đợi (Bull queue), trả response ngay cho user, rồi worker xử lý email sau.

**Connection Pooling (Gom kết nối)**
Tạo sẵn một nhóm kết nối database, các request dùng chung thay vì mỗi request tạo kết nối mới. Giống quầy thu ngân có 5 máy — khách xếp hàng dùng chung, không cần mỗi khách một máy riêng.

---

## Nhật Ký Thay Đổi

| Ngày | Thay đổi |
|---|---|
| 04-11-2026 | Tạo tài liệu workflow ban đầu |
| 04-11-2026 | Dịch sang tiếng Việt và thêm giải thích thuật ngữ |
