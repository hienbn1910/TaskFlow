# TaskFlow — Kế Hoạch Dự Án Chi Tiết

> Kế hoạch của toàn bộ dự án: phạm vi, kiến trúc, ngân sách tài nguyên, mô hình dữ liệu, API, tính năng, các giai đoạn, triển khai.
> Các quyết định và lý do nằm trong [`docs/adr/`](docs/adr/README.md). Khi file này mâu thuẫn với một ADR, ADR đúng và file này được sửa lại (ADR-0038).
> Đây là bản dịch tiếng Việt của [WORKFLOW.md](WORKFLOW.md), được cập nhật trong cùng PR với bản tiếng Anh. Nếu hai bản khác nhau, **bản tiếng Anh đúng**.
> Cập nhật lần cuối: 21-11-2026

---

## Mục Lục

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Công Nghệ Sử Dụng & Lý Do](#2-công-nghệ-sử-dụng--lý-do)
3. [Kiến Trúc Hệ Thống](#3-kiến-trúc-hệ-thống) — gồm Yêu cầu phi chức năng & Ngân sách tài nguyên
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

### TaskFlow là gì?

TaskFlow là một **nền tảng cộng tác SaaS đa người thuê** (multi-tenant SaaS), nơi các nhóm có thể:
- Tạo các workspace tách biệt cho tổ chức của mình
- Trao đổi theo thời gian thực qua các kênh (channel)
- Quản lý công việc trên bảng Kanban
- Chia sẻ file và nhận thông báo

Hãy hình dung nó như Slack + Trello thu gọn, gộp vào một ứng dụng.

### Tại sao chọn dự án này?

Dự án chứng minh với nhà tuyển dụng rằng lập trình viên:
- Xây dựng được ứng dụng SaaS sẵn sàng cho production
- Hiểu multi-tenancy và cách cô lập dữ liệu
- Làm đúng tính năng thời gian thực (phân quyền, kết nối lại, tính nhất quán)
- Nắm vững xác thực, phân quyền và bảo mật
- Triển khai **và vận hành** được ứng dụng thật trong giới hạn thật (ngân sách free tier, khả năng quan sát)
- Viết code sạch, có test, có tài liệu, và ghi lại các quyết định thiết kế kèm đánh đổi

### Đối tượng nhà tuyển dụng mục tiêu

- Công ty tuyển **lập trình viên NestJS / Node.js backend**
- Công ty tuyển **lập trình viên fullstack TypeScript**
- Công ty xây dựng **sản phẩm SaaS**

### Phạm vi

| Trong phạm vi | Ngoài phạm vi |
|---|---|
| Tài khoản email + mật khẩu, xác thực email, đặt lại mật khẩu | OAuth / SSO (guard cho phép thêm sau, Decision #15). Tự xoá tài khoản (mở rộng của M7); khoá và xoá User là thao tác của người vận hành trong database |
| Workspace, vai trò, mời qua link và email | Thanh toán, gói dịch vụ, hạn mức theo khách hàng |
| Kênh public và private, thread một cấp, file đính kèm, mention, đang gõ, trạng thái online | Tin nhắn riêng, reaction, tìm kiếm tin nhắn, gọi thoại / video |
| Bảng Kanban kéo thả realtime, giao việc, hạn chót, nhắc hạn | Bình luận task, task con, trường tùy chỉnh |
| Thông báo trong app và qua email | Push notification, tùy chỉnh thông báo |
| Web app responsive | Ứng dụng mobile native |

---

## 2. Công Nghệ Sử Dụng & Lý Do

### Backend

| Công nghệ | Mục đích | Lý do chọn |
|---|---|---|
| **NestJS 11** | Framework API | Kiến trúc module, DI sẵn có, guard / pipe / interceptor, ưu tiên TypeScript |
| **TypeScript 5.9** (strict) | Ngôn ngữ | An toàn kiểu (phiên bản: Decision #11) |
| **PostgreSQL** (Neon trên production) | Database chính, nơi lưu trữ bền vững duy nhất | Quan hệ, transaction, partial index, composite foreign key để an toàn giữa các tenant (ADR-0021) |
| **Prisma 7** + `@prisma/adapter-pg` | ORM, migration | Query an toàn kiểu, migration theo schema (Decision #12) |
| **`@nestjs/jwt`** + `JwtAuthGuard` tự viết | Xác thực | Không dùng Passport: chỉ cần JWT, và kiểu của Passport mâu thuẫn quy tắc không dùng `any` (Decision #15) |
| **Zod 4** + `nestjs-zod` | Validate, định hình response, OpenAPI | Một schema cho validate lúc chạy, kiểu TypeScript và tài liệu (Decision #7, #13) |
| **bcryptjs** | Băm mật khẩu | Không cần build native (Decision #6; đo lại trên production) |
| **Socket.io** | Thời gian thực | Room, ack, tự kết nối lại (ADR-0025) |
| **`@nestjs/event-emitter`** | Domain event | Tác động phụ giữa các module mà không import lẫn nhau, không vòng phụ thuộc (ADR-0026) |
| **BullMQ** + Redis (Render Key Value trên production) | Công việc nền | Retry có backoff, job lặp lại. Redis là thứ có thể mất: mọi job dựng lại được từ PostgreSQL (ADR-0027) |
| **`@nestjs/throttler`** | Giới hạn tần suất | Lưu trong bộ nhớ, vì chỉ có một instance (ADR-0031) |
| **nestjs-pino** | Log có cấu trúc | JSON, request id, che dữ liệu nhạy cảm (ADR-0035) |
| **Cloudinary** | Lưu file | Upload trực tiếp có chữ ký, phân phối có xác thực cho file riêng tư (ADR-0030) |
| **Resend** (HTTP API) | Email | Render free chặn SMTP; ở máy local, Mailpit bắt email (ADR-0029) |

### Frontend

| Công nghệ | Mục đích | Lý do chọn |
|---|---|---|
| **React** + **Vite** + **TypeScript** | Giao diện, build | Chuẩn ngành, HMR nhanh |
| **TanStack Query** | Server state | Cache, refetch, optimistic update. Là nơi **duy nhất** chứa dữ liệu từ server (ADR-0034) |
| **Zustand** | Client state | Access token trong bộ nhớ, trạng thái socket, tùy chọn giao diện |
| **React Router** | Điều hướng | Id của workspace / channel / board nằm trong URL |
| **Sinh code từ OpenAPI** (đề xuất: orval) | API client | Kiểu, hook và schema Zod sinh từ `openapi.json` của backend (ADR-0033) |
| **React Hook Form** + schema Zod được sinh | Form | Ít render lại, cùng quy tắc với API |
| **Socket.io-client** | Thời gian thực | Khớp backend; một module realtime cập nhật cache của query |
| **dnd-kit** | Kéo thả | Hiện đại, hỗ trợ accessibility — cho bảng Kanban |
| **Tailwind CSS** | Giao diện | Utility-first, design token nhất quán |
| **Vitest** + Testing Library, **Playwright** | Test | Test component; luồng end-to-end (M7) |

### DevOps & Hạ tầng

| Công nghệ | Mục đích | Lý do chọn |
|---|---|---|
| **Docker Compose** | Hạ tầng local | PostgreSQL (dev + test), Redis, Mailpit. API chạy trực tiếp trên máy (Decision #3) |
| **GitHub Actions** | CI/CD | Lint, typecheck, test, migration, deploy hook (ADR-0036) |
| **Render** (Singapore) | Host API + Key Value (Redis) | Miễn phí, một service chạy liên tục (ADR-0018) |
| **Vercel** | Host web + proxy `/api` | Miễn phí, phục vụ file tĩnh ở edge; proxy làm API cùng origin (ADR-0020) |
| **Neon** (Singapore) | PostgreSQL | Miễn phí, tự tắt khi rảnh; endpoint pooled + direct (ADR-0036) |
| **Sentry**, **UptimeRobot** | Theo dõi lỗi, uptime | Gói miễn phí; ping giữ server thức vào `/health` (ADR-0035) |
| **Dependabot** | Cập nhật thư viện | Hằng tuần |

---

## 3. Kiến Trúc Hệ Thống

### Yêu Cầu Phi Chức Năng & Ngân Sách Tài Nguyên

> Các con số mà mọi quyết định thiết kế phải đối chiếu. Giới hạn free tier được kiểm chứng ngày 21-11-2026.
> Nhà cung cấp hay thay đổi giới hạn: kiểm tra lại trước lần deploy đầu tiên và đầu mỗi giai đoạn.

#### Tải dự kiến

| Chỉ số | Dự kiến (dùng để demo) | Mục tiêu thiết kế (vẫn phải chạy tốt) |
|---|---|---|
| User đã đăng ký | ≤ 50 | 500 |
| Workspace | ≤ 10 | 100 |
| Thành viên mỗi workspace | 2–10 | 50 |
| Kết nối WebSocket đồng thời (mỗi tab một kết nối) | ≤ 10 | 100 |
| Tin nhắn gửi | ~100 / ngày | đỉnh 5 / giây, 5.000 / ngày |
| Request REST | ~2.000 / ngày | đỉnh 20 / giây |
| Task | ~200 tổng | 10.000 tổng |
| File đính kèm | ~20 / tháng, trung bình ~1 MB | 500 / tháng, mỗi file ≤ 10 MB |

"Dự kiến" dùng để tính ngân sách free tier bên dưới. "Mục tiêu thiết kế" là mức code phải chịu được mà không cần thiết kế lại: index, phân trang, fan-out và số query được rà soát theo mức này.

#### Mục tiêu dịch vụ

| Mục tiêu | Giá trị | Ghi chú |
|---|---|---|
| Độ trễ API, endpoint thông thường (server đang thức) | p95 < 200 ms tính tại server, < 400 ms tính từ trình duyệt ở Đông Nam Á | Đo ở M7 từ log request (`responseTime`) |
| Endpoint có băm mật khẩu (đăng ký, đăng nhập, đổi mật khẩu) | p95 < 1,5 s | bcrypt cost 10 trên instance 0,1 CPU (xem rủi ro) |
| Fan-out thời gian thực (tin nhắn đã commit → hiện ở client khác) | p95 < 500 ms | |
| Khởi động lạnh khi Render đang ngủ | ~1 phút, chấp nhận | Ping giữ thức tránh được (§8) |
| Tính sẵn sàng | Cố gắng tối đa, không cam kết SLA (free tier) | |
| Độ bền dữ liệu | Dữ liệu đã commit vào PostgreSQL không bao giờ mất | Redis có thể mất toàn bộ bất cứ lúc nào (ADR-0027) |
| Cô lập tenant | Không thể đọc hay ghi chéo giữa các tenant | Yêu cầu bắt buộc, chứng minh bằng integration test |

#### Giới hạn free tier (kiểm chứng 21-11-2026)

| Nhà cung cấp | Giới hạn quan trọng | Hệ quả với thiết kế |
|---|---|---|
| **Render** web service | 512 MB RAM, 0,1 CPU. 750 giờ instance mỗi workspace mỗi tháng. Ngủ sau 15 phút không có traffic, ~1 phút để thức. **Chặn cổng SMTP đi ra (25, 465, 587)** | Một service chạy liên tục tốn 744 giờ (tháng 31 ngày), nên chỉ đủ cho **đúng một**: API, WebSocket gateway và worker chạy chung một process (ADR-0018). Email đi qua HTTP API, không bao giờ qua SMTP (ADR-0029) |
| **Render** Key Value | 25 MB RAM, 50 kết nối, không giới hạn số lệnh, **chỉ lưu trong RAM: mất dữ liệu mỗi lần restart**, một instance miễn phí mỗi workspace | Redis được chọn cho production (ADR-0027). Không có thứ gì được chỉ nằm trong Redis |
| **Upstash** Redis | 500K lệnh / tháng (≈ 16K / ngày) | BullMQ với cấu hình mặc định tốn ≈ 20K lệnh / ngày cho mỗi queue đang rảnh. Vượt ngân sách trước khi có traffic thật: loại (ADR-0027) |
| **Neon** PostgreSQL | 100 CU-giờ / tháng mỗi project, tối thiểu 0,25 CU → **thức ≤ 400 giờ / tháng** (tháng có 744 giờ). Tự tắt sau 5 phút rảnh. 0,5 GB lưu trữ (lấy con số nhỏ hơn; một số nguồn ghi 1 GB). 5 GB truyền tải / tháng | Database phải ngủ khoảng một nửa thời gian. Không tác vụ định kỳ nào được chạm DB thường xuyên hơn mỗi giờ, và ping giữ thức không được chạm DB (ngân sách bên dưới) |
| **Vercel** Hobby | 100 GB băng thông / tháng. Chỉ cho mục đích phi thương mại | Cũng gánh luôn traffic API đi qua proxy (ADR-0020). Portfolio là phi thương mại |
| **Cloudinary** | 25 credit / tháng (1 credit ≈ 1 GB lưu trữ, hoặc 1 GB băng thông, hoặc 1.000 lần biến đổi ảnh) | Giới hạn kích thước mỗi file (ADR-0030) |
| **Resend** (email) | 100 email / ngày, 3.000 / tháng. Gửi đến địa chỉ bất kỳ cần domain đã xác minh | Giới hạn lời mời theo workspace (ADR-0031). Câu hỏi về domain còn mở (ADR-0029) |

#### Ước lượng nhanh (back-of-the-envelope)

**Lưu trữ (Neon, 0,5 GB).** Một dòng tin nhắn ≈ 200 B nội dung + ~150 B các cột + ~250 B trong các index ≈ **0,6 KB**.
- Dự kiến: 100 tin / ngày × 365 ≈ 36.500 dòng / năm ≈ **22 MB / năm**. Dư cho nhiều năm.
- Mục tiêu thiết kế: 5.000 / ngày × 365 ≈ 1,8 triệu dòng ≈ **1,1 GB / năm**: lưu trữ là giới hạn vỡ **đầu tiên**, sau khoảng 5 tháng. Giảm thiểu: nội dung tin nhắn tối đa 4.000 ký tự (ADR-0024), xóa thông báo sau 90 ngày (ADR-0027), hướng nâng cấp = gói Neon trả phí. Không cần sửa code.

**Compute của database (Neon, thức ≤ 400 giờ / tháng).**
- Job định kỳ mỗi giờ: 24 lần thức / ngày × ≥ 5 phút ≈ 2 giờ / ngày ≈ **62 giờ / tháng ≈ 15,5 CU-giờ**.
- Còn lại cho traffic người dùng: ≈ 84 CU-giờ ≈ **336 giờ thức / tháng** ≈ 11 giờ / ngày. Đủ cho mức demo.
- Một job hỏi DB mỗi phút (ví dụ queue chạy trên Postgres, hoặc dùng readiness check làm ping giữ thức) sẽ giữ DB thức 744 giờ ≈ 186 CU-giờ: hết quota vào khoảng ngày 16. Vì vậy có các quy tắc trong ADR-0027: việc định kỳ tối đa mỗi giờ một lần, mọi job định kỳ chạy cùng một phút, `/health` không bao giờ chạm DB.

**Số lệnh Redis.** Ngân sách Upstash ≈ 11 lệnh / phút. Một queue BullMQ đang rảnh ≈ 14 / phút (lệnh lấy job dạng chặn mỗi 5 s + kiểm tra job bị kẹt mỗi 30 s). Đó là lý do dùng Render Key Value (không giới hạn lệnh).

**Ngân sách độ trễ, request khi server đang thức, mọi thứ cùng một region (ADR-0019).**

```
Trình duyệt (Việt Nam) → Vercel edge (Singapore)   ~ 30–50 ms khứ hồi
Vercel edge → Render (Singapore)                   ~ 5 ms
JwtAuthGuard: tải lại user                         ~ 2 ms   (Decision #15)
WorkspaceGuard: kiểm tra thành viên                ~ 2 ms
Query nghiệp vụ (1–2 query)                        ~ 2–5 ms
CPU ứng dụng trên instance 0,1 CPU                 ~ 10–30 ms
                                                   ─────────
                                                   ≈ 60–100 ms   (mục tiêu: < 400 ms)
```

Nếu database ở region khác (ví dụ `us-east-1` trong khi API chạy ở Singapore, ~220 ms khứ hồi), riêng ba query đó đã mất ~660 ms và tự phá vỡ mục tiêu. Vì thế việc đặt chung region là một quyết định (ADR-0019), và hiện chưa cần cache.

**Fan-out thời gian thực.** Mục tiêu thiết kế: 5 tin / giây × 50 thành viên = 250 lần ghi socket / giây trên một process Node. Một instance thừa sức.

#### Rủi ro cần kiểm chứng trong walking skeleton trên production (M2)

| Rủi ro | Cách kiểm tra | Phương án dự phòng |
|---|---|---|
| bcrypt cost 10 với `bcryptjs` (JS thuần) trên 0,1 CPU có thể vượt 1,5 s | Đo `POST /auth/login` trên production | Chuyển sang `bcrypt` native. Cùng định dạng hash: hash cũ vẫn dùng được (Decision #6 sửa đổi) |
| Rewrite ra ngoài của Vercel phải chuyển tiếp `Set-Cookie`, `Origin` và `X-Forwarded-For` | E2E smoke test trên app đã deploy: đăng nhập → tải lại trang → vẫn đăng nhập | Domain riêng (`app.` + `api.` của cùng một domain) |
| Prisma `adapter-pg` qua endpoint pooled (PgBouncer) của Neon | Chạy bộ integration test với một branch của Neon | Dùng endpoint direct khi chạy (một instance, ít kết nối) |
| Render và Neon đều có Singapore | Tạo service | Chọn region gần nhất **mà cả hai đều có** |

#### Chủ động không làm

Đa region, độ sẵn sàng cao, cam kết không downtime, mở rộng ngang (con đường đã ghi trong ADR-0018, chưa xây), sao lưu ngoài cửa sổ khôi phục của nhà cung cấp (chạy `pg_dump` thủ công trước các migration rủi ro).

### Kiến Trúc Tổng Quan

Một **modular monolith**: một process NestJS chạy HTTP API, WebSocket gateway và các worker (ADR-0018). Mọi thứ có trạng thái nằm trong một region (ADR-0019).

```
                          Browser (React SPA)
          │ HTTPS  /api/*  (same origin)               │ WebSocket (direct,
          ▼                                             │ access token in handshake)
  ┌──────────────────────┐                              │
  │ Vercel               │ static files                 │
  │ rewrite /api/* ──────┼──────┐                       │
  └──────────────────────┘      │ HTTPS                 │
                                ▼                       ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Render web service (Singapore) — ONE NestJS process              │
  │                                                                  │
  │  HTTP API          Socket.io gateway        BullMQ workers       │
  │  guards → controllers → services → repositories   + hourly tick  │
  │                         │                                        │
  │                         └── domain events (after commit) ──►     │
  │                             listeners: realtime, notifications,  │
  │                             mail                                 │
  └───────┬──────────────────────┬──────────────────────┬────────────┘
          │                      │                      │ HTTPS
          ▼                      ▼                      ▼
  ┌───────────────┐   ┌────────────────────┐   ┌───────────────────────┐
  │ Neon Postgres │   │ Render Key Value   │   │ Cloudinary (files)  ◄─┼── browser uploads
  │ (Singapore)   │   │ (Redis, Singapore) │   │ Resend (email API)    │   directly (signed)
  │ source of     │   │ queue only,        │   │ Sentry (errors)       │
  │ truth         │   │ disposable         │   └───────────────────────┘
  └───────────────┘   └────────────────────┘
```

### Bản Đồ Module

Các module chỉ phụ thuộc nhau theo một chiều (RULE.md §1). Tác động phụ giữa các module đi qua domain event (ADR-0026).

| Module | Sở hữu bảng | Phát event | Lắng nghe | Giai đoạn |
|---|---|---|---|---|
| `auth` | `refresh_tokens`, `user_tokens` | `user.sessions-revoked` | — | M1, M6 |
| `users` | `users` | `user.sessions-revoked` | — | M1 |
| `workspaces` | `workspaces`, `workspace_members` | `workspace.created`, `member.joined`, `member.left`, `member.removed`, `member.role-changed` | — | M3 |
| `invitations` | `invitations` | `invitation.created` | — | M3 |
| `channels` | `channels`, `channel_members` | `channel.created\|updated\|deleted`, `channel.member-added\|removed` | `workspace.created` (tạo `general`), `member.joined`, `member.left`, `member.removed` | M4 |
| `messages` | `messages`, `message_attachments` | `message.created\|updated\|deleted` | — | M4 |
| `uploads` | — (Cloudinary) | — | — | M4 |
| `realtime` | — (socket, presence) | — | Mọi event client cần thấy; `user.sessions-revoked` | M4 |
| `boards` | `boards`, `board_columns` | `board.*`, `column.*` | — | M5 |
| `tasks` | `tasks` | `task.created\|updated\|moved\|deleted`, `task.assigned` | `member.removed` (bỏ giao việc) | M5 |
| `notifications` | `notifications` | `notification.created` | `task.assigned`, `message.created`, `member.joined`, `invitation.created`, `reminder.due` | M6 |
| `mail` | — | — | `invitation.created`, email tài khoản | M6 |
| `jobs` | — (queue) | `reminder.due` | — | M6 |
| `health` | — | — | — | M1 |

### Luồng Xử Lý Request

```
Client request (through the Vercel proxy)
     │
     ▼
[Express middleware]   helmet · pino-http (X-Request-Id, one log line) · cookie-parser
     │
     ▼
[ThrottlerGuard]       rate limits per IP / user (ADR-0031); real IP via trust proxy
     │
     ▼
[JwtAuthGuard]         global; @Public() opts out; HS256; user reloaded (Decision #15)
     │
     ▼
[WorkspaceGuard]       workspace routes: membership + workspace not deleted;
     │                 attaches workspaceId (from URL only) and role; role check
     ▼
[ZodValidationPipe]    body, params, query (Decision #7)
     │
     ▼
[Controller]           HTTP only: read input, call service
     │
     ▼
[Service]              business rules; transaction through repositories;
     │                 AFTER commit: publish domain events
     ▼
[Repository]           Prisma only; workspaceId as a direct column (ADR-0021)
     │
     ▼
[ZodSerializerInterceptor + ResponseInterceptor]
                       strip unknown fields (Decision #13); { success: true, data, meta? }
     │
     ▼
Client response        Cache-Control: no-store; X-Request-Id

Errors anywhere → GlobalExceptionFilter → { success: false, statusCode, error,
                  message, details?, timestamp, requestId } (Decision #1)
```

### Kiến Trúc Thời Gian Thực (tóm tắt ADR-0025)

```
connect(auth.token) ─► verify like JwtAuthGuard ─► join user:{userId}
                       schedule disconnect at token expiry
workspace:join      ─► check membership ─► join workspace:{id} + channel:{id} of my channels
board:join          ─► check membership ─► join board:{id}

Service commits ─► domain event ─► realtime listener ─► emit to the narrowest room:
   messages / typing → channel:{id}      tasks / columns → board:{id}
   members / public channels / presence → workspace:{id}
   notifications / forced logout → user:{id}

Reconnect ─► re-join rooms ─► refetch what may have been missed (REST is the source of truth)
```

### Luồng Công Việc Nền (tóm tắt ADR-0026, ADR-0027, ADR-0028)

```
Business transaction writes the need into PostgreSQL (e.g. invitations.email_sent_at IS NULL)
     │ commit
     ▼
Enqueue job with a deterministic jobId ──► BullMQ (Redis, disposable)
     │                                          │
     │                                    worker (in the API process)
     │                                          ├── email job → Resend → set email_sent_at
     │                                          └── fails → retry with backoff (5 attempts)
     ▼
Hourly tick at :00 (one database wake-up per hour)
     ├── reminders.scan: tasks due in ≤ 24 h, reminder_sent_at IS NULL
     ├── email.sweep:    rows still unsent after 10 min → enqueue again
     └── cleanup (daily, 20:00 UTC): notifications > 90 days, expired refresh tokens
```

### Các Luồng Quan Trọng

Các luồng này đi qua nhiều module. Mỗi bước ghi rõ quyết định chi phối nó.

**1. Gửi tin nhắn (M4)**
```
Browser                API                         PostgreSQL        Other browsers
  │ optimistic message (clientMessageId)
  │ POST …/messages ───►│ guards, validation, rate limit
  │                     │ transaction: insert message (unique clientMessageId),
  │                     │   update parent replyCount if reply ──► commit
  │                     │ publish message.created (after commit, ADR-0026)
  │ ◄── 201 message ────│
  │ replace optimistic  │ realtime listener ─► emit message:created to channel:{id} ──► append if
  │ by id               │                                                                not present
  │ (retry after a network error → same clientMessageId → 200 with the same message, ADR-0024)
```

**2. Kết nối lại và đồng bộ lại (M4)**
```
Socket drops (network, sleep, deploy)
  → Socket.io reconnects with backoff; the auth callback supplies the current access token
    (refreshed through REST first if expired)
  → server re-authenticates; client emits workspace:join (and board:join if a board is open)
  → client fetches GET …/messages?after=<newest cursor> for the open channel
  → client invalidates: channel list + unread counts, open board, notification count
  → events received during the refetch are deduplicated by id (ADR-0025)
```

**3. Vòng đời lời mời (M3, email từ M6)**
```
ADMIN: POST …/invitations { email, role }
  → transaction: insert PENDING row (tokenHash, expiresAt = now + 7 days) or rotate the token
    of the existing PENDING row → commit → publish invitation.created
  → M3: response contains the link once (copy link). M6: mail listener enqueues the email
Invitee opens FRONTEND_URL/invite?token=… → page removes the token from the address bar
  → POST /invitations/preview { token } (public, rate limited): workspace, inviter, email, status
  → logs in or registers → POST /invitations/accept { token }
  → transaction: PENDING + not expired → ACCEPTED (exactly 1 row), insert member → commit
  → publish member.joined → channels listener adds the member to "general" (M4),
    notifications listener tells admins (M6), realtime emits member:joined
```

**4. Phiên đăng nhập trên trình duyệt (M2)**
```
App start → POST /auth/refresh (cookie, SameSite=Lax, same origin through the proxy)
  → 200: access token kept in memory; user loaded       → 401: show login
Any request → 401 → single-flight refresh (other requests wait) → retry once
  → refresh fails → clear memory and query cache → login page
Logout → POST /auth/logout → cookie cleared, session deleted → clear caches, disconnect socket
Password change / reuse detected → all sessions revoked → user.sessions-revoked
  → realtime disconnects every socket of the user (ADR-0025)
```

**5. Giao task và nhắc hạn (M5 + M6)**
```
PATCH …/tasks/:id/assign { assigneeId } → assignee must be a workspace member
  → update task (reset reminderSentAt) → commit → publish task.assigned
  → realtime: task:updated to board:{id}
  → M6 notifications listener: TASK_ASSIGNED (dedupeKey) → notification:created to user:{assignee}
Hourly tick → reminders.scan → per task, one transaction: reminderSentAt = now + TASK_DUE_SOON
  → after commit: notification:created + email job (best effort with retries, ADR-0028)
```

---

## 4. Thiết Kế Cơ Sở Dữ Liệu

> Các bảng đã xây được định nghĩa bởi `apps/api/prisma/schema.prisma`, file đó đúng hơn phần này (ADR-0038). Các bảng chưa xây được đặc tả ở đây và chuyển thành "đã triển khai" khi giai đoạn của chúng thêm vào.

### Quy ước (áp dụng cho mọi bảng)

| Quy tắc | Chi tiết | Nguồn |
|---|---|---|
| Khóa chính | `id UUID` (v4), do Prisma sinh | — |
| Đặt tên | camelCase trong Prisma, snake_case trong PostgreSQL (`@map`, `@@map`) | RULE.md §2 |
| Thời gian | `timestamptz(3)`, UTC. `createdAt` trên mọi bảng, `updatedAt` trên bảng có sửa đổi | ADR-0023 |
| Khóa tenant | `workspaceId` không null trên mọi bảng của tenant. Composite foreign key `(workspaceId, parentId) → parent(workspaceId, id)` | ADR-0021 |
| Xóa | Xóa mềm hay xóa cứng tùy thực thể, theo danh sách trong ADR-0022 | ADR-0022 |
| Duy nhất khi có xóa mềm | Partial unique index `WHERE deleted_at IS NULL` | ADR-0022 |
| Bí mật | Token chỉ lưu dạng hash `sha256` | Decision #5, ADR-0022 |
| Giới hạn | Mọi chuỗi có độ dài tối đa trong schema Zod, và trong kiểu cột khi hữu ích | RULE.md §5 |

### Sơ đồ quan hệ (ERD)

```
users ──┬──< refresh_tokens
        ├──< user_tokens                       (M6: password reset, email verification)
        ├──< notifications >── workspaces?     (M6)
        │
        └──< workspace_members >── workspaces ──┬──< invitations
                     │                          │
                     │                          ├──< channels ──< messages ──< message_attachments
                     │                          │       │            └──< messages (thread replies)
                     └──────────────< channel_members ──┘
                                                │
                                                └──< boards ──< board_columns ──< tasks >── users (assignee)

Every table right of "workspaces" carries workspaceId (ADR-0021).
```

### Các bảng

#### users — đã triển khai (M1); thay đổi ở M2 và M6
```
id               UUID         PRIMARY KEY
email            VARCHAR(254) NOT NULL, stored lowercase
                              UNIQUE WHERE deleted_at IS NULL            (M2, ADR-0022)
password         VARCHAR      NOT NULL (bcrypt hash)
fullName         VARCHAR(100) NOT NULL
avatarUrl        VARCHAR      NULLABLE (Cloudinary public URL, M4)
isActive         BOOLEAN      DEFAULT true
emailVerifiedAt  TIMESTAMPTZ  NULLABLE                                   (M6, ADR-0029)
lastLoginAt      TIMESTAMPTZ  NULLABLE
deletedAt        TIMESTAMPTZ  NULLABLE (soft delete, Decision #4)
createdAt / updatedAt
```

#### refresh_tokens — đã triển khai (M1)
```
id          UUID        PRIMARY KEY
userId      UUID        FK → users.id, ON DELETE CASCADE
tokenHash   VARCHAR     UNIQUE, NOT NULL (sha256 of the refresh JWT, Decision #5)
expiresAt   TIMESTAMPTZ NOT NULL
createdAt   TIMESTAMPTZ

INDEX: userId · INDEX: expiresAt (daily cleanup)
```

#### user_tokens — M6
```
id           UUID        PRIMARY KEY
userId       UUID        FK → users.id, ON DELETE CASCADE
purpose      ENUM        'RESET_PASSWORD' | 'VERIFY_EMAIL'
tokenHash    VARCHAR     UNIQUE, NOT NULL
expiresAt    TIMESTAMPTZ NOT NULL (reset: 1 h, verify: 24 h)
usedAt       TIMESTAMPTZ NULLABLE (single use)
emailSentAt  TIMESTAMPTZ NULLABLE (ADR-0026 level 3)
createdAt    TIMESTAMPTZ

INDEX: (userId, purpose)
```

#### workspaces — M3
```
id           UUID         PRIMARY KEY
name         VARCHAR(100) NOT NULL (not unique; no slug — URLs use the id, ADR-0034)
description  VARCHAR(500) NULLABLE
logoUrl      VARCHAR      NULLABLE (Cloudinary public URL)
ownerId      UUID         FK → users.id, NOT NULL (exactly one owner, ADR-0032)
deletedAt    TIMESTAMPTZ  NULLABLE (soft delete)
createdAt / updatedAt

INDEX: ownerId
```

#### workspace_members — M3
```
id           UUID        PRIMARY KEY
workspaceId  UUID        FK → workspaces.id
userId       UUID        FK → users.id
role         ENUM        'OWNER' | 'ADMIN' | 'MEMBER', DEFAULT 'MEMBER'
joinedAt     TIMESTAMPTZ

UNIQUE: (workspaceId, userId)   — also the target of channel_members' composite FK
INDEX: userId
```

#### invitations — M3
```
id            UUID         PRIMARY KEY
workspaceId   UUID         FK → workspaces.id
email         VARCHAR(254) NOT NULL, lowercase
role          ENUM         'ADMIN' | 'MEMBER', DEFAULT 'MEMBER'
tokenHash     VARCHAR      UNIQUE, NOT NULL (sha256)
status        ENUM         'PENDING' | 'ACCEPTED' | 'REVOKED'
                           ("expired" = PENDING and expiresAt < now, derived)
invitedById   UUID         FK → users.id
acceptedById  UUID         FK → users.id, NULLABLE
expiresAt     TIMESTAMPTZ  NOT NULL (7 days, reset when the token is rotated)
acceptedAt    TIMESTAMPTZ  NULLABLE
revokedAt     TIMESTAMPTZ  NULLABLE
emailSentAt   TIMESTAMPTZ  NULLABLE (M6)
createdAt / updatedAt

UNIQUE: (workspaceId, email) WHERE status = 'PENDING'          (ADR-0022)
INDEX: workspaceId
```

#### channels — M4
```
id           UUID         PRIMARY KEY
workspaceId  UUID         FK → workspaces.id
name         VARCHAR(80)  NOT NULL
description  VARCHAR(300) NULLABLE
type         ENUM         'PUBLIC' | 'PRIVATE', DEFAULT 'PUBLIC'
isDefault    BOOLEAN      DEFAULT false ("general": cannot be deleted or left)
createdById  UUID         FK → users.id
deletedAt    TIMESTAMPTZ  NULLABLE (soft delete)
createdAt / updatedAt

UNIQUE: (workspaceId, id)                                  — composite FK target
UNIQUE: (workspaceId, lower(name)) WHERE deleted_at IS NULL (ADR-0022)
INDEX: workspaceId
```

#### channel_members — M4
```
id           UUID        PRIMARY KEY
workspaceId  UUID        NOT NULL
channelId    UUID        NOT NULL
userId       UUID        NOT NULL
lastReadAt   TIMESTAMPTZ NULLABLE (unread counts, ADR-0024)
joinedAt     TIMESTAMPTZ

FK: (workspaceId, channelId) → channels(workspaceId, id)
FK: (workspaceId, userId)    → workspace_members(workspaceId, userId), ON DELETE CASCADE
    (a channel member is always a workspace member; leaving the workspace removes them)
UNIQUE: (channelId, userId)
INDEX: userId
```

#### messages — M4
```
id               UUID        PRIMARY KEY
workspaceId      UUID        NOT NULL
channelId        UUID        NOT NULL
senderId         UUID        FK → users.id
parentId         UUID        NULLABLE (thread reply; one level only)
content          TEXT        NOT NULL, 1–4,000 characters (ADR-0024)
clientMessageId  UUID        NOT NULL (idempotent send)
replyCount       INTEGER     DEFAULT 0   (maintained in the reply's transaction)
lastReplyAt      TIMESTAMPTZ NULLABLE
editedAt         TIMESTAMPTZ NULLABLE
deletedAt        TIMESTAMPTZ NULLABLE (soft delete)
createdAt / updatedAt

FK: (workspaceId, channelId) → channels(workspaceId, id)
FK: (channelId, parentId)    → messages(channelId, id)   (a reply stays in its channel)
UNIQUE: (workspaceId, id), (channelId, id)                — composite FK targets
UNIQUE: (channelId, senderId, clientMessageId)
INDEX: (channelId, parentId, createdAt, id)               — cursor pagination, threads
```

#### message_attachments — M4
```
id            UUID         PRIMARY KEY
workspaceId   UUID         NOT NULL
messageId     UUID         NOT NULL
publicId      VARCHAR      NOT NULL (Cloudinary, under taskflow/{env}/ws/{workspaceId}/)
resourceType  ENUM         'IMAGE' | 'FILE'
fileName      VARCHAR(255) NOT NULL (sanitized for display)
fileSize      INTEGER      NOT NULL (bytes; images ≤ 5 MB, files ≤ 10 MB)
mimeType      VARCHAR(100) NOT NULL (allow-list, no SVG / HTML)
width, height INTEGER      NULLABLE (images)
createdAt     TIMESTAMPTZ

FK: (workspaceId, messageId) → messages(workspaceId, id)
INDEX: messageId
```

#### boards — M5
```
id           UUID         PRIMARY KEY
workspaceId  UUID         FK → workspaces.id
name         VARCHAR(100) NOT NULL
createdById  UUID         FK → users.id
deletedAt    TIMESTAMPTZ  NULLABLE (soft delete)
createdAt / updatedAt

UNIQUE: (workspaceId, id)
INDEX: workspaceId
```

#### board_columns — M5
```
id           UUID        PRIMARY KEY
workspaceId  UUID        NOT NULL
boardId      UUID        NOT NULL
name         VARCHAR(50) NOT NULL
position     (type decided in M5, ADR-0009; proposal DOUBLE PRECISION, gap 1000)
color        VARCHAR(7)  NULLABLE (#rrggbb)
isDoneColumn BOOLEAN     DEFAULT false (the Done column: tasks in it are Completed;
                         cannot be deleted; see GLOSSARY.md)
createdAt / updatedAt

FK: (workspaceId, boardId) → boards(workspaceId, id)
UNIQUE: (boardId, id)                                      — target for tasks
UNIQUE: (boardId) WHERE is_done_column                     — at most one Done column per board
INDEX: (boardId, position)
```

#### tasks — M5
```
id              UUID         PRIMARY KEY
workspaceId     UUID         NOT NULL
boardId         UUID         NOT NULL (denormalized for board-wide filters)
columnId        UUID         NOT NULL
title           VARCHAR(200) NOT NULL
description     TEXT         NULLABLE, ≤ 10,000 characters
priority        ENUM         'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', DEFAULT 'MEDIUM'
dueDate         TIMESTAMPTZ  NULLABLE
position        (same type as board_columns.position)
assigneeId      UUID         FK → users.id, NULLABLE (must be a workspace member: service rule)
createdById     UUID         FK → users.id
completedAt     TIMESTAMPTZ  NULLABLE (set when the task enters the Done column, cleared
                             when it leaves; never set directly)
reminderSentAt  TIMESTAMPTZ  NULLABLE (ADR-0028)
createdAt / updatedAt

FK: (workspaceId, boardId) → boards(workspaceId, id)
FK: (boardId, columnId)    → board_columns(boardId, id)    (the column belongs to the task's board)
INDEX: (columnId, position) · INDEX: (workspaceId, assigneeId) · INDEX: dueDate
```

#### notifications — M6
```
id             UUID         PRIMARY KEY
userId         UUID         FK → users.id (recipient)
workspaceId    UUID         FK → workspaces.id, NULLABLE
type           ENUM         'TASK_ASSIGNED' | 'TASK_DUE_SOON' | 'MESSAGE_MENTION'
                            | 'INVITATION_RECEIVED' | 'MEMBER_JOINED'
title          VARCHAR(200) NOT NULL
content        VARCHAR(500) NULLABLE
referenceId    UUID         NULLABLE (no FK: polymorphic; the reader handles a deleted target)
referenceType  ENUM         'TASK' | 'MESSAGE' | 'INVITATION' | 'WORKSPACE', NULLABLE
dedupeKey      VARCHAR(200) UNIQUE (makes listeners idempotent, ADR-0026)
readAt         TIMESTAMPTZ  NULLABLE
createdAt      TIMESTAMPTZ

INDEX: (userId, readAt, createdAt) · INDEX: workspaceId
Retention: deleted after 90 days (daily cleanup, ADR-0027)
```

---

## 5. Thiết Kế API

### Quy ước

| Chủ đề | Quy tắc |
|---|---|
| Đường dẫn gốc | `/api/v1` (RULE.md §9). Trên production, trình duyệt gọi qua origin của web, Vercel làm proxy (ADR-0020) |
| Xác thực | `Authorization: Bearer <access token>` trên mọi route trừ route `@Public()`. Cookie refresh chỉ được gửi đến `/api/v1/auth/*` |
| Tenant | Route của workspace lồng dưới `/workspaces/:workspaceId`. Id **chỉ** lấy từ URL (RULE.md §5) |
| Id và thời gian | UUID; chuỗi ISO 8601 theo UTC (`…Z`) |
| Danh sách offset | `?page=1&limit=20` (`limit` ≤ 100) → `meta: { total, page, limit, totalPages }` |
| Danh sách cursor | `?before=<cursor>` hoặc `?after=<cursor>` kèm `limit` (≤ 50) → `meta: { nextCursor, hasMore }`. Cursor là chuỗi mờ (client không tự giải mã) |
| Mã trạng thái | 200 OK, 201 đã tạo, 204 đã xóa / không có nội dung, 400 validate hoặc quy tắc nghiệp vụ, 401 chưa xác thực, 403 không được phép, 404 không tìm thấy (kể cả tài nguyên của tenant khác), 409 xung đột, 429 vượt giới hạn tần suất |
| Header | `X-Request-Id` trên mọi response; `Retry-After` khi 429; `Cache-Control: no-store` trên mọi response (ADR-0019) |
| Hợp đồng | `apps/api/openapi.json`, được sinh và commit; client của frontend sinh từ file này (ADR-0033) |

### Định dạng phản hồi chuẩn

```json
// Success (single item)
{ "success": true, "data": { ... } }

// Success (offset list)
{ "success": true, "data": [ ... ], "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 } }

// Success (cursor list)
{ "success": true, "data": [ ... ], "meta": { "nextCursor": "eyJj…", "hasMore": true } }

// Error (Decision #1)
{
  "success": false,
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human readable message",
  "details": [ { "field": "email", "message": "Invalid email format" } ],
  "timestamp": "2026-01-01T00:00:00.000Z",
  "requestId": "6f1c…"
}
```

### Danh sách endpoint

Phần mô tả trong các khối dưới đây giữ tiếng Anh như bản gốc để khớp với code và Swagger.

#### Health — `/api/v1/health` (M1, M2)
```
GET    /                      Liveness. No database, no Redis (keep-alive target)      @Public
GET    /ready                 Readiness: database + Redis (M2, ADR-0035)                @Public
```

#### Auth — `/api/v1/auth`
```
POST   /register              Register; returns access token, sets refresh cookie       @Public  M1
POST   /login                 Login; same response                                      @Public  M1
POST   /refresh               Rotate refresh cookie, return new access token            @Public  M1  (Origin check, M2)
POST   /logout                Delete the session, clear the cookie                      @Public  M1  (Origin check, M2)
GET    /me                    Current user                                                       M1
POST   /forgot-password       Send a reset email (same response whether or not the
                              email exists)                                             @Public  M6
POST   /reset-password        Reset with token; revokes all sessions                    @Public  M6
POST   /verify-email          Verify with token                                         @Public  M6
POST   /resend-verification   Send the verification email again                                  M6
```

#### Users — `/api/v1/users`
```
PATCH  /profile               Update full name                                                   M1
PATCH  /password              Change password (current password required);
                              revokes other sessions                                             M1
POST   /avatar/signature      Cloudinary upload signature for an avatar                          M4
PATCH  /avatar                Save the uploaded avatar (verified Cloudinary response)            M4
```

#### Workspaces — `/api/v1/workspaces` (M3)
```
GET    /                                  Workspaces I belong to (paginated)
POST   /                                  Create (I become OWNER)
GET    /:workspaceId                      Details
PATCH  /:workspaceId                      Update name, description, logo (OWNER, ADMIN)
DELETE /:workspaceId                      Soft delete (OWNER)
POST   /:workspaceId/transfer-ownership   Make another member OWNER (OWNER)
POST   /:workspaceId/uploads/signature    Upload signature: attachment | workspace-logo  (M4)
```

#### Workspace Members — `/api/v1/workspaces/:workspaceId/members` (M3)
```
GET    /                      List members (paginated; includes `online`, M4)
PATCH  /:memberId/role        Change role (OWNER: anyone but self; ADMIN: MEMBERs only)
DELETE /:memberId             Remove member (same rule)
POST   /leave                 Leave (not the OWNER)
```

#### Invitations — `/api/v1/workspaces/:workspaceId/invitations` (M3)
```
GET    /                      Pending invitations (ADMIN+, paginated)
POST   /                      Invite { email, role }; re-inviting rotates the token
                              (ADMIN+; 20/day per workspace). Returns the link once
DELETE /:invitationId         Revoke (ADMIN+)
```

#### Invitations, phía người được mời — `/api/v1/invitations` (M3)
```
POST   /preview               { token } → workspace name, inviter, email, status   @Public (rate limited)
POST   /accept                { token } → join the workspace (email must match; verified from M6)
```

#### Channels — `/api/v1/workspaces/:workspaceId/channels` (M4)
```
GET    /                      Channels I can see (public + private where I am a member)
GET    /unread-counts         Unread count per channel, one query (ADR-0024)
POST   /                      Create channel
GET    /:channelId            Details
PATCH  /:channelId            Update name, description (creator or ADMIN+)
DELETE /:channelId            Soft delete (ADMIN+; not "general")
POST   /:channelId/join       Join a public channel
POST   /:channelId/leave      Leave (not "general")
GET    /:channelId/members    List channel members
POST   /:channelId/members    Add a member to a private channel (channel member or ADMIN+)
DELETE /:channelId/members/:userId   Remove from a private channel
POST   /:channelId/read       Mark as read (sets lastReadAt)
```

#### Messages — `/api/v1/workspaces/:workspaceId/channels/:channelId/messages` (M4)
```
GET    /                      Top-level messages, ?before= / ?after= cursors
POST   /                      Send { content, clientMessageId, parentId?, attachments? }
                              (idempotent; 10 / 10 s per user)
PATCH  /:messageId            Edit own message
DELETE /:messageId            Soft delete (sender or ADMIN+)
GET    /:messageId/thread     Replies, same cursor rules
```

#### Boards — `/api/v1/workspaces/:workspaceId/boards` (M5)
```
GET    /                      List boards (paginated)
POST   /                      Create board (default columns: Todo, In Progress, Done)
GET    /:boardId              Board with columns and up to 500 tasks
PATCH  /:boardId              Rename
DELETE /:boardId              Soft delete (ADMIN+)
```

#### Board Columns — `/api/v1/workspaces/:workspaceId/boards/:boardId/columns` (M5)
```
POST   /                      Create column
PATCH  /reorder               Reorder { columnIds: [...] } (declared before /:columnId)
PATCH  /:columnId             Update name, color
DELETE /:columnId             Delete (only when empty)
```

#### Tasks — `/api/v1/workspaces/:workspaceId/boards/:boardId/tasks` (M5)
```
GET    /                      List; filters columnId, assigneeId, priority, dueFrom, dueTo (paginated)
POST   /                      Create task
GET    /:taskId               Details
PATCH  /:taskId               Update title, description, priority, dueDate
                              (completion follows the Done column, see /move)
DELETE /:taskId               Delete
PATCH  /:taskId/move          Move { columnId, beforeTaskId?, afterTaskId? }; the server
                              computes the position from the neighbours (ADR-0009)
PATCH  /:taskId/assign        Assign { assigneeId } or unassign { assigneeId: null }
```

#### Notifications — `/api/v1/notifications` (M6)
```
GET    /                      My notifications (paginated)
GET    /unread-count          Unread count
PATCH  /read-all              Mark all as read
PATCH  /:notificationId/read  Mark one as read
```

### Sự kiện WebSocket

Quy tắc đầy đủ trong ADR-0025. Payload có dạng `{ workspaceId, occurredAt, data }`, trong đó `data` là DTO response REST của tài nguyên đó.

| Chiều | Event | Room | Data | Giai đoạn |
|---|---|---|---|---|
| C → S | `workspace:join` | — | `{ workspaceId }` (ack) | M4 |
| C → S | `board:join`, `board:leave` | — | `{ workspaceId, boardId }` (ack) | M5 |
| C → S | `typing:start`, `typing:stop` | — | `{ workspaceId, channelId }` (ack) | M4 |
| S → C | `message:created`, `message:updated` | `channel:{id}` | Message | M4 |
| S → C | `message:deleted` | `channel:{id}` | `{ id, channelId, parentId }` | M4 |
| S → C | `typing:started`, `typing:stopped` | `channel:{id}` | `{ channelId, userId, fullName }` | M4 |
| S → C | `channel:created`, `channel:updated`, `channel:deleted` | `workspace:{id}` (public) hoặc `channel:{id}` + user room (private) | Channel | M4 |
| S → C | `channel:removed` | `user:{id}` | `{ channelId }` | M4 |
| S → C | `member:joined`, `member:left`, `member:role-changed` | `workspace:{id}` | Member | M4 |
| S → C | `presence:online`, `presence:offline` | `workspace:{id}` | `{ userId }` | M4 |
| S → C | `workspace:removed` | `user:{id}` | `{ workspaceId }` | M4 |
| S → C | `task:created`, `task:updated`, `task:moved` | `board:{id}` | Task | M5 |
| S → C | `task:deleted` | `board:{id}` | `{ id, columnId }` | M5 |
| S → C | `column:created`, `column:updated`, `column:deleted`, `columns:reordered` | `board:{id}` | Column / `{ columnIds }` | M5 |
| S → C | `notification:created` | `user:{id}` | Notification | M6 |
| S → C | `exception` | chính socket đó | Định dạng lỗi của Decision #1 | M4 |

---

## 6. Đặc Tả Tính Năng

### Tính năng 1: Xác thực (M1; củng cố ở M2; luồng email ở M6)

**Đăng ký**
- Đầu vào: email (cắt khoảng trắng, chuyển chữ thường), mật khẩu (≥ 8 ký tự, một chữ hoa, một chữ số, ≤ 72 byte), fullName.
- Email không được thuộc về một user chưa bị xóa → nếu có, trả 409.
- Băm bằng bcryptjs, cost 10 (Decision #6). Tạo user.
- Cấp access token (15 phút) và refresh token (7 ngày); lưu `sha256(refresh)`; refresh token chỉ nằm trong cookie httpOnly (Decision #5).
- M6: gửi email xác thực (`user_tokens`, email mức 3, ADR-0026).

**Đăng nhập**
- Email không tồn tại và sai mật khẩu trả về cùng một kết quả: 401 "invalid credentials".
- User bị khóa hoặc đã xóa không đăng nhập được (`canSignIn`).
- Có giới hạn tần suất (ADR-0031).

**Làm mới token** (xoay vòng kèm phát hiện dùng lại)
- Đọc cookie (`Origin` phải là `FRONTEND_URL`, ADR-0020). Xác minh JWT, rồi xóa hash của nó.
- Xóa được 1 dòng → cấp cặp mới. Xóa được 0 dòng → token đã bị dùng: **thu hồi mọi phiên** của user, trả 401, xóa cookie.

**Đăng xuất**
- Xóa phiên, xóa cookie. Client xóa bộ nhớ, cache và ngắt socket.

**Đặt lại mật khẩu và xác thực email (M6)**
- Token dùng một lần, lưu dạng hash trong `user_tokens`; token đặt lại hết hạn sau 1 giờ, token xác thực sau 24 giờ.
- `forgot-password` trả lời giống nhau dù email có tồn tại hay không.
- Đặt lại thành công thì thu hồi mọi phiên.

### Tính năng 2: Workspace, Thành viên, Lời mời (M3)

**Tạo workspace**
- Đầu vào: name (1–100 ký tự, không bắt buộc duy nhất), description tùy chọn. Không có slug: URL dùng id của workspace (ADR-0034).
- Một transaction: workspace + thành viên OWNER. Sau commit: `workspace.created` (M4 dựa vào event này để tạo "general").

**WorkspaceGuard (mọi route của workspace)**
```
1. workspaceId from the URL params only
2. Find the membership (workspaceId, userId) where the workspace is not deleted
3. Not found → 404 (do not reveal that the workspace exists)
4. Attach workspaceId and role to the request; check @WorkspaceRoles(...)
5. Repositories filter tenant data by this workspaceId (ADR-0021)
```

**Ma trận vai trò**

| Hành động | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Sửa workspace | ✅ | ✅ | ❌ |
| Xóa workspace, chuyển quyền sở hữu | ✅ | ❌ | ❌ |
| Mời, thu hồi lời mời | ✅ | ✅ | ❌ |
| Đổi vai trò / xóa một ADMIN | ✅ | ❌ | ❌ |
| Đổi vai trò / xóa một MEMBER | ✅ | ✅ | ❌ |
| Rời workspace | ❌ (chuyển quyền trước) | ✅ | ✅ |
| Xóa bất kỳ channel / board nào, xóa tin nhắn của người khác | ✅ | ✅ | ❌ |

**Chuyển quyền sở hữu:** Owner chọn một Member khác; trong một transaction, Member đó trở thành OWNER và Owner cũ trở thành ADMIN (ADR-0032).

**Lời mời:** vòng đời trong ADR-0022, quy tắc chấp nhận trong ADR-0032, luồng ở §3 "Các luồng quan trọng" số 3. Khi rời hoặc bị xóa khỏi workspace, các task được giao cho thành viên đó bị bỏ giao, và tư cách thành viên các channel bị xóa theo (cascade).

**User bị khoá và User bị xoá** là thao tác của người vận hành trong database, không có giao diện (xem `GLOSSARY.md`). User bị xoá bị gỡ khỏi mọi Workspace; tin nhắn của họ vẫn còn, hiện dưới tên "Deleted user". Nếu User đó là Owner, người vận hành chuyển quyền sở hữu trước.

Thuật ngữ cho tính năng này và các tính năng sau: [`GLOSSARY.md`](GLOSSARY.md).

### Tính năng 3: Channel & Nhắn tin (M4)

**Channel**
- Mọi workspace có một channel public mặc định là "general" (`isDefault`): mọi thành viên đều ở trong đó; không thể xóa hay rời.
- Channel public: thành viên nào cũng thấy và tham gia được. Channel private: chỉ thành viên của channel thấy; được thêm bởi một thành viên của channel hoặc ADMIN trở lên.

**Gửi tin nhắn**
- Chỉ qua REST. Kiểm tra: là thành viên channel, nội dung 1–4.000 ký tự, mention chỉ trỏ đến thành viên channel, ≤ 5 file đính kèm (upload đã xác minh, ADR-0030).
- Một transaction: insert (idempotent theo `clientMessageId`), cập nhật `replyCount` / `lastReplyAt` của tin gốc nếu là trả lời.
- Sau commit: `message.created` → socket event đến `channel:{id}`; M6: thông báo mention.

**Tải tin nhắn:** phân trang cursor `(createdAt, id)`; `before` để cuộn lên, `after` để đồng bộ lại (ADR-0024). Không dùng phân trang offset ở đây vì tin mới làm các trang bị dịch chuyển.

**Chưa đọc:** `lastReadAt` cho mỗi thành viên channel; sidebar tải mọi số đếm bằng một query; mở channel thì đánh dấu đã đọc.

**Đang gõ và trạng thái online:** ADR-0025 (danh tính lấy ở server, giới hạn tần suất, tự dừng sau 5 s, chờ 10 s trước khi báo offline).

**File đính kèm:** upload trực tiếp có chữ ký, phân phối riêng tư cho file đính kèm (ADR-0030).

### Tính năng 4: Bảng Kanban (M5)

**Vị trí:** quyết định đầu M5 (ADR-0009; đề xuất: vị trí số thực theo khoảng cách, có cân bằng lại). Client gửi các task hàng xóm (`beforeTaskId`, `afterTaskId`); server tính vị trí trong một transaction có khóa, nên hai lần kéo đồng thời không tạo ra vị trí trùng nhau.

**Giao việc:** người được giao phải là thành viên workspace. Đổi người được giao hoặc hạn chót sẽ đặt lại `reminderSentAt`. Sau commit: `task.assigned`.

**Hoàn thành theo Done column:** mỗi Board có đúng một Done column (`isDoneColumn`; trên Board mới là cột "Done"). Task được tạo trong hoặc kéo vào cột đó thì nhận `completedAt = now`; kéo ra thì `completedAt` bị xoá. Done column đổi tên được nhưng không xoá được; chưa hỗ trợ chọn cột khác làm Done column. Nhờ vậy bảng và việc nhắc hạn luôn khớp nhau: Task đã kéo sang Done không bao giờ bị nhắc.

**Nhắc hạn:** quét mỗi giờ, nhắc trước hạn 23–24 giờ, mỗi hạn chót một lần (ADR-0028).

**Bộ lọc:** người được giao, độ ưu tiên, khoảng hạn chót, cột; phân trang offset.

### Tính năng 5: Thông báo (M6)

**Loại và nguồn kích hoạt** (mỗi loại do một listener tạo, idempotent nhờ `dedupeKey`)
```
TASK_ASSIGNED       ← task.assigned                  to the assignee (not when self-assigned)
TASK_DUE_SOON       ← hourly reminders.scan          to the assignee
MESSAGE_MENTION     ← message.created with mentions  to mentioned channel members
INVITATION_RECEIVED ← invitation.created             to the invitee, if they already have an account
MEMBER_JOINED       ← member.joined                  to OWNER and ADMINs
```

**Gửi đi**
- Trong app: một dòng trong DB + `notification:created` đến `user:{id}` (cố gắng tối đa, mức 2 của ADR-0026).
- Email: lời mời (gửi đến địa chỉ email, mức 3), nhắc hạn (cố gắng tối đa, có retry), email tài khoản (mức 3).
- Lưu giữ: 90 ngày.

---

## 7. Các Giai Đoạn & Thời Gian

> Lập lại kế hoạch ngày 21-11-2026 theo lát dọc (ADR-0037). Kế hoạch cũ làm backend suốt bốn giai đoạn, làm frontend sau đó, và deploy cuối cùng.

### Quy tắc lập kế hoạch

1. **Lát dọc.** Mỗi giai đoạn giao backend + frontend + test cho các tính năng của nó, và kết thúc ở trạng thái **đã deploy lên production, dùng được trên trình duyệt**.
2. **Chỉ phụ thuộc ngược.** Một giai đoạn chỉ dùng những gì các giai đoạn trước đã xây. Nếu một tính năng cần giai đoạn sau, tính năng đó dời sang giai đoạn sau, hoặc giai đoạn trước phát một domain event để giai đoạn sau lắng nghe (ADR-0026).
3. **Đọc trước.** Mỗi giai đoạn liệt kê các ADR cần đọc trước khi viết spec. Chúng có tính bắt buộc.
4. **Một branch = một Development Flow** (RULE.md §0): spec → plan → tasks trong `docs/specs|plans|tasks/<branch>.md`, rồi code, test, kiểm tra, PR.
5. **Tiêu chí hoàn thành được kiểm tra trên production** từ M2 trở đi, không chỉ trong test.
6. **"Không thuộc giai đoạn này"** liệt kê những gì cố ý hoãn và hoãn đến đâu, để không bị quên.
7. **Mức giao diện:** chạy đúng và nhất quán, có trạng thái loading, rỗng và lỗi trên mọi màn hình mới. Làm đẹp và responsive toàn bộ ở M7 (ADR-0034).

### Tổng quan

| # | Giai đoạn | Tuần | Kết quả đã deploy |
|---|---|---|---|
| M1 | Nền tảng & Auth API | 1–2 | ✅ Xong (chỉ API, chạy local) |
| M2 | Nền tảng web, giao diện auth, walking skeleton trên production | 3–4 | Đăng ký / đăng nhập / hồ sơ trên URL thật |
| M3 | Workspace, thành viên, lời mời | 5–6 | Tạo workspace, mời qua link, quản lý vai trò |
| M4 | Channel, nhắn tin realtime, upload | 7–9 | Chat trực tiếp có thread, file đính kèm, trạng thái online |
| M5 | Bảng Kanban | 10–11 | Kéo thả realtime |
| M6 | Thông báo, email, công việc nền | 12–13 | Thông báo, email mời và nhắc hạn, đặt lại mật khẩu |
| M7 | Củng cố, hoàn thiện & ra mắt | 14–15 | Đã đo, đã kiểm tra bảo mật, có tài liệu, sẵn sàng demo |

Tổng thời gian tăng từ 13 lên 15 tuần: phần frontend và deploy giờ được rải đều qua mọi giai đoạn thay vì ước lượng một lần ở cuối, và M2 xử lý trước các rủi ro tích hợp.

---

### Giai đoạn 1: Nền tảng & Auth API (Tuần 1–2) — ✅ Xong

**Mục tiêu:** user đăng ký, đăng nhập, làm mới và thu hồi phiên, quản lý hồ sơ qua API.

Đã giao: pnpm monorepo, NestJS strict, Prisma 7 với `users` + `refresh_tokens`, Docker Compose (DB dev + test, Redis), config env bằng Zod, global exception filter, response interceptor, Zod validation pipe, Swagger tại `/api/docs`, health endpoint, module auth (đăng ký, đăng nhập, làm mới có xoay vòng và phát hiện dùng lại, đăng xuất, me), JWT guard toàn cục, module users (hồ sơ, mật khẩu), unit test + integration test.

Quyết định: ADR-0001 … ADR-0017.

---

### Giai đoạn 2: Nền Tảng Web, Giao Diện Auth & Walking Skeleton Trên Production (Tuần 3–4)

**Mục tiêu:** các tính năng auth của M1 chạy trọn vẹn **trên URL production**, và mọi rủi ro tích hợp liệt kê ở §3 "Rủi ro cần kiểm chứng" đều đã được đo.

**Phụ thuộc:** M1.
**Đọc trước:** ADR-0006, 0019, 0020, 0023, 0031, 0033, 0034, 0035, 0036.

**Branch `chore/api-production-readiness`** (API, trước khi công khai)
```
2.1  Schema conventions migration: every DateTime → timestamptz(3) USING … AT TIME ZONE 'UTC'
     (ADR-0023); users.email unique only WHERE deleted_at IS NULL (ADR-0022)
2.2  prisma7.config.ts reads DIRECT_DATABASE_URL, falls back to DATABASE_URL (ADR-0036)
2.3  Refresh cookie SameSite=Lax; Origin check on /auth/refresh and /auth/logout (ADR-0020)
2.4  trust proxy (TRUST_PROXY env); Cache-Control: no-store on every response (ADR-0019, 0020)
2.5  Rate limiting with @nestjs/throttler, M2 rows of ADR-0031
2.6  nestjs-pino JSON logs, X-Request-Id, requestId in error bodies (ADR-0035)
2.7  GET /health/ready (database + Redis); /health stays dependency-free (ADR-0035)
2.8  openapi:export script; apps/api/openapi.json committed (ADR-0033)
2.9  Tests for each item (429, Origin 403, requestId, timestamptz round trip)
2.9b Wording: "account" → "User" in comments and Swagger descriptions (GLOSSARY.md)
```

**Branch `feature/web-foundation`**
```
2.10 Vite + React + TypeScript strict, ESLint, Vitest; folder structure of RULE.md §11
2.11 Tailwind + base tokens (colors, spacing, typography); app shell and public layout
2.12 React Router: public routes, protected routes, not-found page
2.13 Generated API client + TanStack Query hooks from openapi.json (proposal: orval)
2.14 HTTP client: credentials, single-flight refresh on 401, retry once (ADR-0034)
2.15 Auth store: access token in memory only; session restore on boot
2.16 Vite proxy /api → localhost:3000 (ADR-0020); error boundary; toast notifications
```

**Branch `feature/web-auth`**
```
2.17 Pages: Login, Register, Profile (edit name), Change password, Logout
2.18 Form validation with generated Zod schemas; server errors mapped to fields
2.19 Component tests for forms and the refresh flow
```

**Branch `chore/deploy-pipeline`**
```
2.20 Neon project (Singapore): pooled + direct URLs
2.21 Render web service (Singapore): env vars, health check path /api/v1/health,
     auto-deploy off + deploy hook; Render Key Value (Singapore)
2.22 Vercel project: vercel.json rewrites /api → Render, security headers + CSP,
     preview deployments disabled
2.23 GitHub Actions: PR pipeline and main pipeline (migrate deploy → deploy hook) (ADR-0036)
2.24 Dependabot; UptimeRobot on /health every 5 min; Sentry for API and web (ADR-0035)
2.25 Verify the §3 risks and record the results in §3:
     login latency (bcryptjs on 0.1 CPU), cookie through the proxy (Chrome + Safari),
     trust proxy value (real client IP in logs), Neon pooled endpoint with adapter-pg
```

**Tiêu chí hoàn thành (trên production):**
- [ ] Đăng ký, đăng nhập, tải lại trang vẫn còn đăng nhập, trên Chrome **và Safari**
- [ ] Sửa hồ sơ, đổi mật khẩu (các phiên khác bị thu hồi), đăng xuất
- [ ] Lần đăng nhập nhanh thứ 6 trả 429 kèm `Retry-After`
- [ ] Tìm được `requestId` của một response lỗi trong log của Render
- [ ] Merge vào `main` tự chạy CI, migration và deploy, không bước thủ công nào
- [ ] Đã đo p95 của đăng nhập và ghi vào §3 (chuyển sang `bcrypt` native nếu > 1,5 s, Decision #6)

**Không thuộc giai đoạn này:** quên / đặt lại mật khẩu và xác thực email → M6. Làm đẹp giao diện → M7.

---

### Giai đoạn 3: Workspace, Thành Viên & Lời Mời (Tuần 5–6)

**Mục tiêu:** user tạo workspace, mời người khác qua link, quản lý vai trò. Cô lập tenant được chứng minh bằng test.

**Phụ thuộc:** M1, M2.
**Đọc trước:** ADR-0021, 0022, 0026, 0031, 0032. Task đầu tiên: kiểm tra Prisma 7.10 có hỗ trợ partial index trong schema không (ADR-0022).

**Branch `feature/workspaces`**
```
3.1  Schema: workspaces, workspace_members (composite keys, ADR-0021; no slug)
3.2  WorkspaceGuard: membership + workspace not deleted; attaches workspaceId and role
3.3  Decorators: @CurrentWorkspace(), @WorkspaceRoles(...)
3.4  CRUD: list mine, create, get, update, soft delete
3.5  Transfer ownership: new Owner → OWNER, previous Owner → ADMIN (ADR-0032);
     domain event workspace.created
3.6  Web: workspace list / switcher, create dialog, settings page, delete (owner)
```

**Branch `feature/workspace-members`**
```
3.7  List (paginated), change role, remove, leave — role rules of ADR-0032
3.8  Domain events member.joined, member.left, member.removed
3.9  Web: members page with role actions
```

**Branch `feature/invitations`**
```
3.10 Schema: invitations (tokenHash, status PENDING/ACCEPTED/REVOKED, partial unique pending)
3.11 Create (ADMIN+, returns the link once; 20/day per workspace), list pending,
     revoke, re-invite rotates the token (ADR-0022)
3.12 POST /invitations/accept { token }: authenticated, email must match, atomic (ADR-0032)
3.13 Domain event invitation.created (M6 subscribes for the email)
3.14 Web: invite dialog with "copy link", pending list, /invite?token=… page
     (login or register first, token removed from the address bar, then accept)
```

**Test (ngoài unit test và test endpoint):**
- Bộ test cô lập: thành viên workspace A nhận 404 trên **mọi** endpoint của workspace B (đọc và ghi), không bao giờ nhận được dữ liệu (ADR-0021)
- Đồng thời: chấp nhận lời mời hai lần, hai lần chuyển quyền sở hữu cùng lúc (ADR-0032)
- Ma trận vai trò: OWNER / ADMIN / MEMBER × mọi hành động trên thành viên và lời mời

**Tiêu chí hoàn thành (trên production):**
- [ ] Tạo workspace, copy link mời, tài khoản thứ hai chấp nhận, cả hai thấy nhau trong danh sách thành viên
- [ ] MEMBER không mời được (403); người ngoài nhận 404 trên mọi URL của workspace
- [ ] Link hết hạn hoặc đã thu hồi hiện thông báo rõ ràng; chấp nhận bằng email khác bị từ chối
- [ ] Chuyển được quyền sở hữu; owner không thể rời trước khi chuyển

**Không thuộc giai đoạn này:** email mời → M6 (event đã được phát sẵn). Channel "general" → M4 (kèm backfill cho các workspace đã có).

---

### Giai đoạn 4: Channel, Nhắn Tin Realtime & Upload (Tuần 7–9)

**Mục tiêu:** thành viên chat realtime trong channel public và private, có thread, file đính kèm và trạng thái online. Sự kiện bị lỡ được khôi phục sau khi kết nối lại.

**Phụ thuộc:** M1–M3.
**Đọc trước:** ADR-0024, 0025, 0026, 0030, 0031.

**Branch `feature/channels`**
```
4.1  Schema: channels (isDefault), channel_members (workspaceId, lastReadAt)
4.2  CRUD; join / leave public; add / remove members of private channels; soft delete (ADMIN+)
4.3  "general": created on workspace.created (listener), idempotent ensureDefaultChannel,
     data migration for workspaces created in M3; new members join it (member.joined)
4.4  POST …/channels/:id/read; unread counts for the whole sidebar in one query (ADR-0024)
4.5  Web: sidebar with unread badges, create channel, browse and join public channels,
     private channel members
```

**Branch `feature/messages`**
```
4.6  Schema: messages (workspaceId, clientMessageId, replyCount, lastReplyAt, editedAt)
4.7  List with before/after cursors, send (idempotent), edit and soft delete own
     (ADMIN may delete any), thread list; mention tokens limited to channel members
4.8  Rate limit 10 messages / 10 s per user; domain events message.created|updated|deleted
4.9  Web: message list with infinite scroll upwards, composer with optimistic send,
     edit / delete, thread panel, mention picker
```

**Branch `feature/realtime-gateway`**
```
4.10 Gateway: handshake auth, disconnect at token expiry, forced disconnect on
     session revocation (event from users/auth) (ADR-0025)
4.11 Rooms user / workspace / channel with authorization; leave rooms on removal
4.12 Listeners: message, channel and member events → socket events (envelope + DTO)
4.13 Typing (throttled, server-side timeout); presence (PresenceStore, 10 s grace)
4.14 Acks and error shape; 20 events / 10 s per socket
4.15 Web: realtime module (connect with token, reconnect with a fresh token, resync,
     cache updates), typing indicator, presence dots
```

**Branch `feature/uploads`**
```
4.16 Signature endpoints; verification of the Cloudinary response; folder per tenant (ADR-0030)
4.17 Schema: message_attachments; signed delivery URLs for attachments
4.18 Avatar and workspace logo (public)
4.19 Web: attach files in the composer with previews; avatar in profile; logo in settings
```

**Test:**
- Integration test với socket (app thật + `socket.io-client`): không join được workspace của tenant khác; người ngoài channel private không nhận được gì; thành viên bị xóa thôi nhận event; token hết hạn bị ngắt kết nối
- Phân trang cursor vẫn ổn định khi tin nhắn đang được thêm; gửi idempotent; số tin chưa đọc

**Tiêu chí hoàn thành (trên production):**
- [ ] Hai trình duyệt: tin nhắn hiện ở bên kia trong < 500 ms; đang gõ và trạng thái online hoạt động
- [ ] Channel private vô hình với người ngoài, cả trên giao diện lẫn trên socket
- [ ] Ngắt mạng 30 giây rồi kết nối lại: các tin bị lỡ hiện ra mà không cần tải lại trang
- [ ] Bấm "gửi" hai lần khi mạng chậm chỉ tạo một tin nhắn
- [ ] URL file đính kèm của channel private không dùng được nếu thiếu chữ ký

**Không thuộc giai đoạn này:** thông báo @mention → M6 (lắng nghe `message.created`). Dọn file upload mồ côi → mục mở rộng của M7.

---

### Giai đoạn 5: Bảng Kanban (Tuần 10–11)

**Mục tiêu:** thành viên quản lý task trên bảng với kéo thả realtime.

**Phụ thuộc:** M1–M4 (realtime gateway).
**Đọc trước:** ADR-0009 (quyết định kiểu `position` trước tiên), 0021, 0025, 0026, 0032.

**Branch `feature/boards`**
```
5.1  Schema: boards, board_columns (workspaceId)
5.2  Board CRUD (soft delete ADMIN+), default columns (Todo, In Progress, Done);
     "Done" is the board's Done column (isDoneColumn, cannot be deleted)
5.3  Column CRUD (delete only when empty) and reorder
5.4  Web: board list, board page with columns
```

**Branch `feature/tasks`**
```
5.5  Schema: tasks (workspaceId, boardId, composite FK to column, dueDate timestamptz,
     reminderSentAt) (ADR-0021, 0028)
5.6  CRUD; move with positions and rebalancing in one locking transaction (ADR-0009);
     entering / leaving the Done column sets / clears completedAt
5.7  Assign / unassign (assignee must be a member) → domain event task.assigned
5.8  Filters: assignee, priority, due range (offset pagination); changing dueDate or
     assignee resets reminderSentAt
5.9  Web: drag and drop (dnd-kit), task drawer, filters, assignee and due-date pickers
```

**Branch `feature/board-realtime`**
```
5.10 Board rooms (board:join / board:leave) with authorization
5.11 task:* and column:* events; web cache updates
```

**Test:** di chuyển và sắp xếp lại (kể cả hai lần kéo đồng thời), cân bằng lại vị trí, task không thể trỏ đến cột của board hay workspace khác (composite FK), bộ lọc.

**Tiêu chí hoàn thành (trên production):**
- [ ] Hai trình duyệt thấy thao tác kéo thả của nhau ngay lập tức; thứ tự giữ nguyên sau khi tải lại
- [ ] Bộ lọc hoạt động; giao task phát `task.assigned` (thấy trong log)

**Không thuộc giai đoạn này:** thông báo giao việc và nhắc hạn → M6.

---

### Giai đoạn 6: Thông Báo, Email & Công Việc Nền (Tuần 12–13)

**Mục tiêu:** user nhận thông báo trong app và qua email; đặt lại mật khẩu và xác thực email hoạt động; việc định kỳ chạy trong ngân sách free tier.

**Phụ thuộc:** M1–M5.
**Đọc trước:** ADR-0016, 0026, 0027, 0028, 0029. **Quyết định trước:** câu hỏi về domain của ADR-0029.

**Branch `feature/notifications`**
```
6.1  Schema: notifications
6.2  Listeners: task.assigned → TASK_ASSIGNED; message.created mentions → MESSAGE_MENTION;
     member.joined → MEMBER_JOINED (admins); invitation.created → INVITATION_RECEIVED
     (if the invitee has an account). All idempotent
6.3  List (paginated), unread count, mark read, mark all read; notification:created to user room
6.4  Web: bell with unread badge, dropdown, notifications page
```

**Branch `feature/jobs-and-mail`**
```
6.5  BullMQ: email and maintenance queues, worker options, graceful shutdown (ADR-0027)
6.6  MailService port: Resend adapter, SMTP → Mailpit adapter (+ docker-compose service),
     test fake (ADR-0029)
6.7  Invitation email (invitations.emailSentAt + deterministic jobId); hourly email.sweep
6.8  Hourly tick at :00: reminders.scan (ADR-0028), email.sweep; daily cleanup
6.9  /health/ready includes Redis; daily email quota guard
```

**Branch `feature/password-reset-and-verification`**
```
6.10 Forgot / reset password: hashed single-use token, 1 h expiry, revokes all sessions
6.11 Email verification: emailVerifiedAt, verification email, resend link; accepting
     an invitation now requires a verified email
6.12 Web: forgot password, reset password, verify-email banner and page
```

**Test:** listener idempotent; ranh giới cửa sổ nhắc hạn và không nhắc trùng; đặt lại khi đổi hạn chót; sweep đưa lại email chưa gửi vào queue; HTTP vẫn chạy khi queue không khả dụng.

**Tiêu chí hoàn thành (trên production):**
- [ ] Email mời đến nơi và link trong đó dùng được
- [ ] Giao task thì thông báo hiện ngay; email nhắc hạn đến trước hạn chót 23–24 giờ
- [ ] Restart Render Key Value không làm mất gì (email chậm tối đa một giờ)
- [ ] Quên mật khẩu → email → đặt lại → các phiên cũ bị đăng xuất
- [ ] Sau một tuần, mức dùng Neon compute và Resend nằm trong ngân sách §3

---

### Giai đoạn 7: Củng Cố, Hoàn Thiện & Ra Mắt (Tuần 14–15)

**Mục tiêu:** ứng dụng đang chạy đạt các mục tiêu ở §3, qua được checklist bảo mật, và được trình bày chỉn chu.

**Phụ thuộc:** M1–M6.

**Branch `chore/security-audit`**
```
7.1  Checklist: every route guarded or @Public; every tenant query has workspaceId;
     no sensitive field in any response or event; errors do not leak internals;
     socket rooms authorized; rate limits in place (RULE.md §5)
7.2  passwordChangedAt: reject access tokens issued before a password change (Decision #17)
```

**Branch `chore/performance`**
```
7.3  N+1 review from query logs; an index for every WHERE / ORDER BY (RULE.md §4)
7.4  Measure §3 targets from production logs; small k6 load test at the design target
     on a local stack; deviations explained in an ADR
```

**Branch `chore/ux-polish`**
```
7.5  Responsive pass (mobile), accessibility basics (labels, focus, contrast)
7.6  Playwright E2E for the critical flows (auth, workspace, invite, message, move task) in CI
```

**Branch `docs/launch`**
```
7.7  seed:demo run once on production (demo account + workspace)
7.8  README: description, live link, screenshots / GIF, architecture diagram, NFR table,
     ADR highlights, how to run locally, how to run tests
```

**Mở rộng (chỉ khi còn thời gian):** tự xoá tài khoản (xác nhận bằng mật khẩu; từ chối nếu User đang là Owner), audit log cho hành động của admin, dọn file upload mồ côi, PostgreSQL Row-Level Security (ADR-0021), Socket.io Redis adapter (con đường mở rộng trong ADR-0018).

**Tiêu chí hoàn thành:**
- [ ] Mọi mục tiêu ở §3 đã được đo và ghi lại (hoặc giải thích chỗ lệch trong một ADR)
- [ ] Checklist bảo mật hoàn tất; bộ test Playwright xanh trong CI
- [ ] README hoàn chỉnh; nhà tuyển dụng đăng nhập bằng user demo và thấy nội dung thật

---

## 8. Kế Hoạch Triển Khai

### Phát triển cục bộ

Hạ tầng chạy trong Docker, API và web app chạy trực tiếp trên máy (Decision #3).

```
docker compose up -d       postgres (5432), postgres-test (5433, tmpfs), redis (6379)
                           + mailpit (SMTP 1025, web UI 8025) from M6 (ADR-0029)
pnpm --filter api db:migrate
pnpm dev                   API on :3000 (watch); from M2 also the web app on :5173
```

Vite dev server làm proxy `/api` sang `localhost:3000`, nên môi trường local có cùng cấu hình một origin như production (ADR-0020). Sao chép `.env.example` thành `.env` và `.env.test`.

### Kiến trúc Production

```
Pull request ──► GitHub Actions: lint → typecheck → unit → integration + E2E
                 (Postgres + Redis service containers) → openapi.json up to date → web build

Merge to main ─► same checks ─► prisma migrate deploy (DIRECT_DATABASE_URL, Neon)
                              ─► Render deploy hook (auto-deploy OFF: code never runs
                                 before its migration)
              ─► Vercel builds and deploys the web app from main (preview deployments OFF)

Browser ─► Vercel (static + /api/* rewrite) ─► Render web service ─► Neon (pooled)
        ─► Render web service directly for the WebSocket                 Render Key Value
                                                                         Cloudinary · Resend · Sentry
UptimeRobot ─► GET /api/v1/health every 5 min (keeps Render awake; never touches the database)
```

Migration theo nguyên tắc expand → migrate → contract (ADR-0036): mọi migration phải chạy được với code đang được deploy.

### Các dịch vụ

| Dịch vụ | Cấu hình |
|---|---|
| Render web service | Region Singapore. Build `pnpm install --frozen-lockfile && pnpm --filter api build`. Start `pnpm --filter api start`. Health check path `/api/v1/health`. Tắt auto-deploy; deploy hook lưu trong GitHub secret |
| Render Key Value | Region Singapore (cùng web service). URL nội bộ làm `REDIS_URL`. Gói free: chỉ lưu trong RAM (ADR-0027) |
| Neon | Region `ap-southeast-1` (Singapore). URL pooled → `DATABASE_URL`; URL direct → `DIRECT_DATABASE_URL` (secret của CI và Render) |
| Vercel | Thư mục gốc `apps/web`. `vercel.json`: rewrite `/api/:path*` → `https://<render-service>.onrender.com/api/:path*`, fallback SPA về `index.html`, security header + CSP. Tắt preview deployment |
| Cloudinary | Thư mục `taskflow/{env}/…`; file đính kèm upload dạng `authenticated` (ADR-0030) |
| Resend | Domain gửi đã xác minh (câu hỏi mở của ADR-0029) |
| Sentry | Project cho API và web; DSN là biến môi trường |
| UptimeRobot | Monitor HTTP vào `/api/v1/health`, chu kỳ 5 phút, cảnh báo qua email |

### Biến môi trường (production)

```
# API (Render)
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
TRUST_PROXY=<value verified in M2>          # ADR-0020: number of proxy hops (Vercel → Render)

DATABASE_URL=postgresql://…-pooler…/taskflow?sslmode=require     # runtime, pooled
DIRECT_DATABASE_URL=postgresql://…/taskflow?sslmode=require      # Prisma CLI only

REDIS_URL=redis://red-…:6379                # Render Key Value internal URL

JWT_ACCESS_SECRET=<random, ≥ 32 chars>
JWT_REFRESH_SECRET=<different random, ≥ 32 chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

FRONTEND_URL=https://<app>.vercel.app       # Origin check, socket CORS, links in emails

CLOUDINARY_CLOUD_NAME=…                     # M4
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…

MAIL_PROVIDER=resend                        # M6 (smtp locally → Mailpit)
MAIL_FROM=TaskFlow <no-reply@<domain>>
RESEND_API_KEY=…

SENTRY_DSN=…

# Web (Vercel, build time)
VITE_SOCKET_URL=https://<render-service>.onrender.com   # WebSocket goes direct (ADR-0020)
VITE_SENTRY_DSN=…
```

Không có `BACKEND_URL` (link trong email trỏ về frontend) và không có cấu hình SMTP trên production (ADR-0029). `.env.example` liệt kê mọi biến kèm giá trị mẫu an toàn.

### Giới hạn free tier

Giới hạn đã kiểm chứng, ngân sách và các rủi ro cần đo nằm ở §3 "Yêu cầu phi chức năng & Ngân sách tài nguyên". Tóm tắt các quy tắc vận hành rút ra từ đó:

- Đúng một service Render chạy liên tục (750 giờ/tháng): API, gateway và worker chung một process.
- Render ngủ sau 15 phút không có traffic và mất ~1 phút để thức: UptimeRobot ping `/health` mỗi 5 phút. `/health` không chạm DB, nên Neon vẫn tự tắt được.
- Việc định kỳ chạy tối đa mỗi giờ một lần, tất cả ở phút :00, để Neon chỉ thức một lần mỗi giờ.
- Redis có thể bị xóa sạch bất cứ lúc nào: không có thứ gì chỉ nằm trong Redis.

---

## 9. Hướng Dẫn Làm Việc

### Dành cho lập trình viên

```
1. Open the current milestone in §7 and CLAUDE.md "Current Milestone"
2. Read the ADRs listed under "Read first"
3. For each branch, follow RULE.md §0:
   a. Spec   → docs/specs/<branch>.md   (scope, inputs/outputs, edge cases, acceptance criteria)
   b. Plan   → docs/plans/<branch>.md   (data flow, files, schemas, dependencies, decisions)
   c. Tasks  → docs/tasks/<branch>.md   (small, ordered, one commit each)
   d. Code + tests per task; full test run; performance and security checklists; refactor
   e. Update docs (CLAUDE.md status, ADR index, WORKFLOW.md + WORKFLOW-VI.md if changed)
   f. PR: lint, typecheck, all tests green
4. Check the milestone's completion criteria on production, then move on
```

Tóm tắt: mở giai đoạn hiện tại → đọc các ADR được liệt kê → với mỗi branch làm spec, plan, tasks → code và test từng task → cập nhật tài liệu → PR → kiểm tra tiêu chí hoàn thành trên production.

### Dành cho AI

```
Before generating ANY code:
1. Read CLAUDE.md (entry point), then RULE.md
2. Read the ADRs listed for the current milestone and the WORKFLOW.md sections of the feature
3. Check what already exists in the code; never duplicate
4. If a request conflicts with an ADR, RULE.md or this file: say so and follow the documents

When implementing a feature (inside the Development Flow):
1. Prisma schema + migration (review the generated SQL: ADR-0022, ADR-0023, ADR-0036)
2. Repository (workspaceId as a direct column)
3. Service (business rules, transactions, domain events after commit)
4. DTOs (Zod) and controller (@ZodResponse)
5. Tests: unit for services, integration for endpoints, isolation and concurrency where relevant
6. Frontend: generated client, hooks, components, realtime cache updates
7. Explain what was built and why

When fixing a bug:
1. Find the root cause first and explain it
2. Write a test that fails because of the bug
3. Fix it; the test passes; run the full suite
```

### Mẫu prompt cho các công việc thường gặp

**Làm một tính năng mới:**
```
Implement [feature] for milestone [N], branch [name].

Context:
- Spec / plan / tasks: docs/specs|plans|tasks/[branch].md
- ADRs: [list]
- Related existing files: [list]
- Tables involved: [list]

Follow RULE.md, the ADRs and WORKFLOW.md.
```

**Thêm một endpoint:**
```
Add [METHOD] [path].

It should:
- [What it does]
- [Validation rules]
- [Who can access it — which roles]
- [What it returns, which events it publishes]

Related Prisma model: [model]
Follow Controller → Service → Repository (RULE.md §3).
```

**Sửa lỗi:**
```
Bug: [what is wrong]
Expected: [what should happen]
Actual: [what happens]
Request id / logs: [if from production]

Relevant files:
- [paths]

Find the root cause, add a failing test, fix it.
```

---

## 10. Danh Sách File Tham Khảo

```
CLAUDE.md                        ← Điểm bắt đầu: quy tắc cho agent, trạng thái hiện tại, mục lục quyết định
RULE.md                          ← Quy tắc và tiêu chuẩn code (backend §1–§10, frontend §11)
WORKFLOW.md                      ← Kế hoạch: NFR, kiến trúc, schema, API, các giai đoạn
WORKFLOW-VI.md                   ← File này: bản dịch tiếng Việt + giải thích thuật ngữ
GLOSSARY.md                      ← Ngôn ngữ nghiệp vụ: mỗi khái niệm một tên, dùng chung cho code, API, UI
docs/adr/                        ← Architecture Decision Records (mỗi file một quyết định)
docs/specs/ docs/plans/ docs/tasks/   ← Spec, plan, danh sách task của từng branch
apps/api/prisma/schema.prisma    ← Nguồn sự thật cho các bảng đã xây
apps/api/openapi.json            ← Hợp đồng API được sinh tự động (từ M2)
.env.example                     ← Mọi biến môi trường kèm giá trị mẫu
docker-compose.yml               ← Hạ tầng local
README.md                        ← Tài liệu công khai của dự án (hoàn thiện ở M7)
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

**Modular Monolith (Nguyên khối chia module)**
Toàn bộ backend là một ứng dụng duy nhất, chạy trong một process, nhưng bên trong chia thành các module có ranh giới rõ ràng (auth, workspaces, messages…). Ngược với microservices (mỗi phần là một dịch vụ riêng, giao tiếp qua mạng). Ở quy mô của dự án và với free tier chỉ cho một service, modular monolith đơn giản hơn nhiều mà vẫn giữ được cấu trúc sạch (ADR-0018).

**Domain Event (Sự kiện nghiệp vụ)**
Một thông báo nội bộ kiểu "việc X vừa xảy ra" (`message.created`, `task.assigned`), được phát **sau khi** dữ liệu đã commit. Các module khác lắng nghe và tự xử lý phần của mình (gửi socket, tạo thông báo, gửi email). Module phát không cần biết ai nghe, nên không có phụ thuộc vòng và giai đoạn trước không cần chờ giai đoạn sau (ADR-0026).

**Idempotent (Lũy đẳng)**
Làm một việc nhiều lần cho ra kết quả giống như làm một lần. Ví dụ: bấm "gửi" hai lần với cùng `clientMessageId` chỉ tạo một tin nhắn. Rất quan trọng khi có retry, vì mạng chập chờn hay worker chạy lại sẽ lặp thao tác.

**At-least-once / Best effort (Ít nhất một lần / Cố gắng tối đa)**
Hai mức đảm bảo khi gửi một thứ gì đó. *Best effort*: cố gửi, nếu lỗi thì có thể mất (đẩy socket, thông báo trong app). *At-least-once*: chắc chắn đến nơi, có thể đến hơn một lần nên bên nhận phải idempotent (email lời mời). Chọn mức theo cái giá phải trả khi bị mất (ADR-0026).

**Transactional Outbox**
Kỹ thuật để không mất tác vụ phụ: ghi "việc cần làm" vào database **trong cùng transaction** với dữ liệu nghiệp vụ, rồi một tiến trình khác đọc và thực hiện. Dự án dùng phiên bản gọn: cột `emailSentAt IS NULL` chính là "việc cần làm", job quét mỗi giờ gửi lại những gì còn sót.

**Walking Skeleton (Bộ khung biết đi)**
Phiên bản nhỏ nhất của hệ thống chạy trọn vẹn từ đầu đến cuối trên môi trường thật (trình duyệt → proxy → API → database), dù chưa có nhiều tính năng. Mục đích: phát hiện sớm các vấn đề tích hợp (cookie, proxy, giới hạn hạ tầng) thay vì đến cuối dự án mới biết (M2).

**Vertical Slice (Lát dọc)**
Cách chia công việc theo tính năng hoàn chỉnh: mỗi giai đoạn làm đủ backend + frontend + test cho một nhóm tính năng. Ngược với lát ngang (làm hết backend rồi mới làm frontend). Lát dọc cho ra thứ dùng được sau mỗi giai đoạn (ADR-0037).

**ADR (Architecture Decision Record — Hồ sơ quyết định kiến trúc)**
Một file ngắn ghi lại một quyết định: bối cảnh, quyết định, các phương án đã cân nhắc và hệ quả. Không sửa lịch sử: muốn đổi thì viết ADR mới thay thế. Giúp người đến sau (và chính mình sau vài tháng) hiểu *tại sao*, không chỉ *cái gì*.

### Yêu cầu phi chức năng & tài nguyên

**NFR (Non-Functional Requirements — Yêu cầu phi chức năng)**
Những yêu cầu về *hệ thống chạy tốt đến đâu*, không phải *làm được gì*: độ trễ, tải chịu được, độ bền dữ liệu, bảo mật, chi phí. Không có NFR thì không thể nói một thiết kế là "đủ" hay "thiếu".

**Latency / Throughput (Độ trễ / Thông lượng)**
Độ trễ: một request mất bao lâu (ms). Thông lượng: hệ thống xử lý được bao nhiêu request mỗi giây. p95 = 95% request nhanh hơn con số này, tức là đo cả những trường hợp chậm chứ không chỉ trung bình.

**Back-of-the-envelope estimate (Ước lượng nhanh)**
Phép tính thô bằng các con số tròn để biết một thiết kế có khả thi không, trước khi xây. Ví dụ: 5.000 tin/ngày × 0,6 KB ≈ 1,1 GB/năm → vượt 0,5 GB của Neon sau khoảng 5 tháng.

**Capacity Budget (Ngân sách tài nguyên)**
Chia một giới hạn cố định (giờ compute, số lệnh Redis, email/ngày) cho các phần của hệ thống, để biết phần nào được phép tiêu bao nhiêu. Ví dụ: job định kỳ được dùng ~15 CU-giờ trên 100 CU-giờ của Neon.

**CU-hour (Compute Unit-giờ) / Scale to zero**
Đơn vị tính compute của Neon: 1 CU chạy trong 1 giờ. *Scale to zero*: database tự tắt khi không ai dùng (sau 5 phút) và chỉ tính tiền/quota khi đang thức. Vì thế không được đánh thức database liên tục.

**Region co-location (Đặt chung khu vực)**
Đặt các dịch vụ hay gọi nhau (API, database, Redis) trong cùng một vùng địa lý, để mỗi lần gọi chỉ mất vài ms thay vì hàng trăm ms (ADR-0019).

### Xác thực & Bảo mật

**JWT (JSON Web Token)**
Một "thẻ ra vào" kỹ thuật số. Sau khi đăng nhập, server tạo một token (chuỗi ký tự dài) chứa thông tin user. Client gửi token này kèm mọi request để chứng minh "tôi đã đăng nhập". Token có thời hạn và không thể giả mạo.

**Access Token**
Token ngắn hạn (15 phút) dùng để truy cập API. Hết hạn nhanh để giảm rủi ro nếu bị đánh cắp. Frontend chỉ giữ nó trong bộ nhớ.

**Refresh Token**
Token dài hạn (7 ngày) dùng để xin access token mới khi token cũ hết hạn. Được lưu an toàn hơn (httpOnly cookie — JavaScript không đọc được), database chỉ lưu hash của nó.

**Refresh Token Rotation (Xoay vòng token)**
Mỗi lần dùng refresh token, hệ thống phát hành cặp token hoàn toàn mới và hủy cái cũ. Nếu ai đó dùng lại token cũ, hệ thống hiểu là token đã bị đánh cắp và thu hồi mọi phiên của user đó.

**Single-flight refresh**
Khi nhiều request cùng nhận 401 vì access token hết hạn, frontend chỉ gửi **một** request làm mới; các request khác chờ kết quả đó rồi chạy lại. Nếu không, nhiều lần làm mới song song sẽ làm token xoay vòng chồng chéo và bị coi là dùng lại.

**bcrypt**
Thuật toán băm mật khẩu một chiều. Biến "mypassword123" thành chuỗi như "$2b$10$N9qo8uLOickgx2ZMRZoMye..." Không thể giải mã ngược lại. Khi đăng nhập, hệ thống băm mật khẩu bạn nhập rồi so sánh với chuỗi đã lưu. Cố ý chậm để chống dò mật khẩu.

**httpOnly Cookie**
Cookie mà JavaScript không thể đọc được — chỉ trình duyệt tự động gửi kèm request. An toàn hơn localStorage vì kẻ tấn công không thể đánh cắp qua XSS (tấn công qua mã JavaScript độc).

**SameSite / Third-party cookie (Cookie bên thứ ba)**
`SameSite` quy định khi nào trình duyệt gửi cookie kèm request từ trang khác: `Lax` chỉ gửi khi request đến từ cùng site (và khi điều hướng thông thường), `None` gửi cả từ site lạ. Khi web ở `vercel.app` mà API ở `onrender.com`, cookie của API là cookie bên thứ ba, và Safari chặn loại này. Dự án giải quyết bằng proxy để web và API cùng một origin (ADR-0020).

**CSRF (Cross-Site Request Forgery — Giả mạo request từ site khác)**
Một trang độc hại khiến trình duyệt của bạn gửi request đến ứng dụng mà kèm cookie của bạn, ví dụ ép đăng xuất. Chống bằng `SameSite=Lax` và kiểm tra header `Origin` trên các route dùng cookie.

**CORS (Cross-Origin Resource Sharing)**
Cơ chế cho phép một trang web gọi API ở origin khác. Mặc định trình duyệt chặn. Nhờ proxy của Vercel, REST API trên production cùng origin với web nên không cần CORS; CORS chỉ còn dùng cho kết nối WebSocket đi thẳng đến Render.

**Reverse Proxy**
Máy chủ đứng trước, nhận request rồi chuyển tiếp đến máy chủ thật phía sau. Ở đây Vercel nhận `/api/*` trên domain của web rồi chuyển sang Render, nên trình duyệt chỉ thấy một origin. Khi có proxy, phải cấu hình `trust proxy` để server biết IP thật của người dùng.

**Rate Limiting (Giới hạn tần suất)**
Giới hạn số request mỗi user / IP có thể gửi trong một khoảng thời gian. Ví dụ: tối đa 5 lần đăng nhập mỗi phút. Ngăn dò mật khẩu, spam và lạm dụng API. Vượt giới hạn thì nhận 429 kèm `Retry-After`.

**Soft Delete (Xóa mềm)**
Thay vì xóa dữ liệu thật sự khỏi database, chỉ đánh dấu `deletedAt = thời gian hiện tại`. Dữ liệu vẫn còn nhưng không hiển thị cho user. Lợi ích: có thể khôi phục, giữ lại lịch sử, tránh phá vỡ liên kết giữa các bảng. Cái giá: ràng buộc UNIQUE phải bỏ qua các dòng đã xóa (partial unique index).

**404 thay vì 403 cho người ngoài**
Người không thuộc workspace nhận 404 ("không tồn tại") thay vì 403 ("không được phép"), để response không tiết lộ rằng workspace hay tài nguyên đó có tồn tại.

### Cơ sở dữ liệu

**UUID (Universally Unique Identifier)**
Chuỗi ID dạng `550e8400-e29b-41d4-a716-446655440000`. Không thể đoán được, khác với ID tự tăng (1, 2, 3...) nơi kẻ tấn công có thể đoán ID tiếp theo. UUID v4 là ngẫu nhiên nên **không có thứ tự** — không dùng một mình làm vị trí phân trang được.

**Khóa chính (Primary Key)**
Cột duy nhất xác định mỗi bản ghi trong bảng. Không được trùng, không được NULL. Giống số CCCD — mỗi người một số duy nhất.

**Khóa ngoại (Foreign Key — FK)**
Cột trong bảng này tham chiếu đến khóa chính của bảng khác, tạo mối liên kết. `workspace_members.userId → users.id` nghĩa là cột userId trong bảng workspace_members trỏ đến cột id trong bảng users.

**Composite Foreign Key (Khóa ngoại kép)**
Khóa ngoại gồm nhiều cột. `messages(workspaceId, channelId) → channels(workspaceId, id)` nghĩa là tin nhắn chỉ có thể trỏ đến một channel **cùng workspace**. Nếu code có lỗi định gắn tin nhắn vào channel của tenant khác, database từ chối luôn (ADR-0021).

**Index (Chỉ mục)**
Cấu trúc giúp database tìm kiếm nhanh hơn. Giống như mục lục cuối sách — thay vì đọc từng trang để tìm chủ đề, bạn tra mục lục. Đặt index trên cột hay tìm kiếm (email, workspaceId). Nhược điểm: tốn thêm dung lượng và chậm hơn khi ghi dữ liệu.

**Partial Unique Index (Chỉ mục duy nhất một phần)**
Ràng buộc UNIQUE chỉ áp dụng cho một số dòng, ví dụ `UNIQUE (email) WHERE deleted_at IS NULL`: hai user chưa xóa không được trùng email, nhưng user đã xóa không giữ chỗ email đó nữa (ADR-0022).

**timestamptz**
Kiểu thời gian của PostgreSQL có gắn múi giờ: lưu một thời điểm tuyệt đối (quy về UTC). Kiểu `timestamp` thường không có múi giờ nên dễ bị hiểu sai khi máy chủ hay công cụ dùng múi giờ khác (ADR-0023).

**Migration**
File ghi lại thay đổi cấu trúc database theo thời gian. Thêm bảng mới? Tạo migration. Thêm cột? Tạo migration. Giống như lịch sử git nhưng cho database. Cho phép đồng bộ cấu trúc DB giữa các máy và môi trường.

**Expand → Migrate → Contract**
Cách đổi schema mà không làm hỏng code đang chạy: *mở rộng* trước (thêm cột mới, cho phép null), *chuyển* dữ liệu và code sang dùng cái mới, rồi ở một lần phát hành **sau** mới *thu gọn* (xóa cái cũ). Không bao giờ đổi tên hay xóa trong cùng lần phát hành với code (ADR-0036).

**ORM (Object-Relational Mapping)**
Công cụ cho phép bạn tương tác với database bằng code thay vì viết SQL trực tiếp. `prisma.user.findMany()` thay vì `SELECT * FROM users`. Prisma là ORM chúng ta dùng.

**N+1 Query (Truy vấn N+1)**
Lỗi hiệu suất phổ biến. Ví dụ: lấy 100 user (1 query), rồi cho mỗi user lấy tasks (100 query nữa) = 101 query. Đúng ra chỉ cần 1-2 query với JOIN hoặc include. Giống như gọi điện hỏi từng học sinh điểm thi, thay vì lấy cả bảng điểm một lần.

**Transaction (Giao dịch)**
Nhóm nhiều thao tác database thành một "gói". Hoặc tất cả thành công, hoặc tất cả hủy bỏ. Ví dụ: chuyển tiền — trừ tiền người gửi VÀ cộng tiền người nhận phải xảy ra cùng lúc. Nếu một bước thất bại, hoàn tác tất cả.

**Race Condition (Tranh chấp đồng thời) / Last write wins**
Hai request cùng lúc thao tác trên một dữ liệu và kết quả phụ thuộc vào cái nào chạy trước, ví dụ hai người cùng chấp nhận một lời mời. Chống bằng ràng buộc của database và cập nhật có điều kiện (ADR-0032). *Last write wins*: khi hai người cùng sửa một task, lần ghi sau cùng được giữ — chấp nhận được vì mọi thay đổi đều được phát realtime.

### Kiến trúc ứng dụng

**Controller (Bộ điều khiển)**
Lớp nhận request từ client, gọi service xử lý, rồi trả response. KHÔNG chứa logic nghiệp vụ. Giống lễ tân — nhận yêu cầu từ khách, chuyển cho bộ phận phù hợp, rồi trả kết quả.

**Service (Dịch vụ)**
Lớp chứa TẤT CẢ logic nghiệp vụ. "Nếu user đã tồn tại thì báo lỗi", "Nếu workspace đầy thì không cho thêm thành viên". Giống bộ phận xử lý — quyết định làm gì với yêu cầu.

**Repository (Kho dữ liệu)**
Lớp CHỈ tương tác với database. Viết query, đọc/ghi dữ liệu. Giống thủ kho — chỉ lo việc lấy hàng và cất hàng, không quan tâm hàng dùng để làm gì.

**DTO (Data Transfer Object — Đối tượng truyền dữ liệu)**
Đối tượng định nghĩa dữ liệu đầu vào (request) và đầu ra (response). Giống form đăng ký — quy định cần điền gì, format ra sao. `RegisterDto` quy định cần email, password, fullName. `UserResponseDto` quy định trả về id, email, fullName (KHÔNG trả password).

**Guard (Lính gác)**
Code kiểm tra quyền trước khi request đến controller. `JwtAuthGuard` kiểm tra đã đăng nhập chưa (chạy toàn cục, `@Public()` để bỏ qua). `WorkspaceGuard` kiểm tra có thuộc workspace không và vai trò có đủ không.

**Decorator**
Nhãn đặc biệt gắn lên class, method, hoặc parameter để thêm hành vi. `@Controller()`, `@Get()`, `@Public()` là các decorator. Giống như dán nhãn lên hộp — nhìn nhãn biết bên trong là gì và xử lý thế nào.

**OpenAPI / Codegen (Sinh code)**
OpenAPI là file mô tả toàn bộ API (endpoint, tham số, response) theo chuẩn. Backend tự sinh file này từ schema Zod; frontend dùng công cụ sinh code để tạo client, kiểu và hook từ đó. Nhờ vậy frontend không phải gõ lại kiểu dữ liệu bằng tay và không bị lệch với backend (ADR-0033).

### Thời gian thực

**Room (Phòng)**
Nhóm các kết nối socket để gửi một sự kiện cho đúng những người cần nhận: `channel:{id}` cho tin nhắn của một channel, `user:{id}` cho thông báo của một người. Vào room nào cũng phải được kiểm tra quyền như với HTTP.

**Ack (Acknowledgement — Xác nhận)**
Phản hồi của server cho một sự kiện client gửi lên, giống response của HTTP: `{ success: true }` hoặc một lỗi theo định dạng chuẩn.

**Resync (Đồng bộ lại)**
Socket.io không đảm bảo mọi sự kiện đến nơi: mất mạng vài giây là mất các sự kiện trong khoảng đó. Khi kết nối lại, client tải lại những gì có thể đã lỡ qua REST (ví dụ tin nhắn sau cursor mới nhất). REST là nguồn sự thật, socket chỉ là đường tắt (ADR-0025).

**Presence (Trạng thái online)**
Biết ai đang online. Server đếm số kết nối của mỗi user; chỉ báo offline khi số kết nối về 0 và đã chờ 10 giây, để việc tải lại trang không làm trạng thái nhấp nháy.

### Frontend

**SPA (Single Page Application)**
Ứng dụng web chỉ tải một trang HTML duy nhất, sau đó JavaScript xử lý mọi thứ — chuyển trang, tải dữ liệu, cập nhật giao diện — mà không cần tải lại trang. React, Vue, Angular đều tạo SPA.

**State (Trạng thái)**
Dữ liệu thay đổi trong ứng dụng. "User đang đăng nhập" là state. "Danh sách tin nhắn" là state. "Form đang nhập dở" là state. Quản lý state tốt = ứng dụng chạy mượt.

**Server State vs Client State**
Server state: dữ liệu từ server (danh sách user, tin nhắn...) — chỉ do TanStack Query quản lý.
Client state: dữ liệu chỉ tồn tại ở trình duyệt (access token trong bộ nhớ, sidebar đang mở/đóng...) — dùng Zustand quản lý.

**Optimistic Update (Cập nhật lạc quan)**
Hiện kết quả trên giao diện ngay khi người dùng thao tác, trước khi server trả lời; nếu server báo lỗi thì hoàn tác. Ví dụ: tin nhắn hiện ngay khi bấm gửi.

**HMR (Hot Module Replacement)**
Khi bạn sửa code, trình duyệt tự cập nhật NGAY mà không cần tải lại trang. Vite làm việc này rất nhanh.

### DevOps & Vận hành

**Docker**
Công cụ "đóng gói" ứng dụng cùng mọi thứ nó cần (OS, thư viện, cấu hình) vào một "container". Container chạy giống nhau trên mọi máy. Giống như shipping container — bên trong chứa đủ thứ, vận chuyển đi đâu cũng chạy được.

**Docker Compose**
Công cụ chạy nhiều container cùng lúc. Một lệnh `docker compose up -d` khởi động PostgreSQL + Redis (+ Mailpit) cho môi trường local, thay vì phải cài và cấu hình từng thứ.

**CI/CD (Continuous Integration / Continuous Deployment)**
CI: mỗi PR tự động chạy lint → typecheck → test → build. Nếu có lỗi, báo ngay.
CD: khi merge vào `main` và CI pass, tự chạy migration rồi triển khai lên production. Không cần deploy thủ công.

**Cold Start (Khởi động lạnh)**
Khi server đã ngủ (free tier), request đầu tiên phải chờ server thức dậy — với Render là khoảng 1 phút. Các request sau đó nhanh bình thường. Ping định kỳ giữ cho server không ngủ.

**Liveness / Readiness**
Hai loại health check. *Liveness* (`/health`): process còn sống không — không chạm database, dùng cho ping giữ thức. *Readiness* (`/health/ready`): đã sẵn sàng phục vụ chưa — kiểm tra database và Redis, chỉ dùng khi cần (ADR-0035).

**Structured Log / Request ID (Log có cấu trúc / Mã request)**
Log dạng JSON có các trường cố định (method, status, thời gian xử lý…) thay vì câu văn tự do, nên lọc và tìm được. Mỗi request có một mã riêng, trả về cho client và ghi vào mọi dòng log liên quan, nên từ một lỗi người dùng báo có thể tìm ngay log tương ứng.

**Seed Data (Dữ liệu mẫu)**
Script tạo dữ liệu mẫu trong database để demo. Thay vì nhà tuyển dụng vào thấy trống trơn, họ thấy workspace có sẵn kênh chat, tin nhắn, task board... trông chuyên nghiệp hơn.

### Hiệu năng

**Caching (Bộ nhớ đệm)**
Lưu kết quả vào bộ nhớ nhanh để lần sau không cần hỏi database. Giống như photo trang sách hay xem. Cái giá là phải xóa cache đúng lúc khi dữ liệu thay đổi, nếu không sẽ trả dữ liệu cũ. Dự án **chưa dùng cache** vì đo ra chưa cần (ADR-0019); chỉ thêm khi một endpoint đo được chậm hơn mục tiêu.

**Cursor-based Pagination (Phân trang theo con trỏ)**
Thay vì nói "lấy trang 5" (offset), nói "lấy 30 tin nhắn TRƯỚC vị trí này" (cursor). Ổn định hơn khi có dữ liệu mới liên tục (tin nhắn chat). Dự án dùng cursor là cặp `(createdAt, id)` vì UUID v4 không có thứ tự.

**Background Job (Công việc nền)**
Công việc xử lý ở hậu trường, không làm chậm response cho user. Ví dụ: gửi email mất 2-3 giây. Thay vì bắt user chờ, ta đưa việc gửi email vào hàng đợi (BullMQ queue), trả response ngay, rồi worker xử lý sau, có thử lại nếu lỗi.

**Connection Pooling (Gom kết nối)**
Tạo sẵn một nhóm kết nối database, các request dùng chung thay vì mỗi request tạo kết nối mới. Giống quầy thu ngân có 5 máy — khách xếp hàng dùng chung. Neon có endpoint *pooled* cho ứng dụng và endpoint *direct* cho migration.

**Fan-out**
Một sự kiện được gửi đến nhiều người nhận. Một tin nhắn trong channel 50 người = 50 lần ghi socket. Gửi vào room hẹp nhất có thể để không tốn công gửi cho người không cần.

---

## Nhật Ký Thay Đổi

| Ngày | Thay đổi |
|---|---|
| 04-11-2026 | Tạo tài liệu workflow ban đầu |
| 04-11-2026 | Dịch sang tiếng Việt và thêm giải thích thuật ngữ |
| 21-11-2026 | Rà soát thiết kế hệ thống: thêm Yêu cầu phi chức năng & Ngân sách tài nguyên (§3); kiến trúc, bản đồ module và các luồng quan trọng (§3); schema có khóa tenant, composite FK, timestamptz, partial unique index (§4); cập nhật quy ước API và endpoint (§5); cập nhật tính năng (§6); lập lại các giai đoạn theo lát dọc, deploy từ M2 (§7); cập nhật triển khai theo giới hạn free tier đã kiểm chứng (§8). Các quyết định được ghi thành ADR-0001 … ADR-0038. Bổ sung thuật ngữ mới (§11) |
| 21-11-2026 | Phiên chốt thuật ngữ (`GLOSSARY.md`): workspace không có slug; chuyển quyền sở hữu thì Owner cũ thành Admin; mỗi Board có một Done column quyết định việc hoàn thành; khoá và xoá User là thao tác của người vận hành, tự xoá tài khoản là mở rộng của M7 |
