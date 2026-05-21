# SportTube - Event-Driven Video Upload Platform

A video-sharing platform built with **Spring Boot 3**, **Apache Kafka**, **MySQL**, and **FFmpeg**. Features include video upload with AI content moderation, user authentication, subscriptions, comments, likes, playlists, watch history, and an admin panel.

---

## Features

- **Video Upload & Streaming** — Upload videos up to 500MB with drag-and-drop; stream directly in the browser
- **Event-Driven Processing Pipeline** — 3-stage async pipeline via Kafka (upload → AI analysis → processing → publish)
- **AI Content Moderation** — Profanity filtering (regex + optional OpenAI Moderation API)
- **Sports Classification** — Keyword-based + optional Gemini API frame analysis
- **Thumbnail Extraction** — Auto-generated from video using FFmpeg/JavaCV
- **User Authentication** — JWT-based registration/login with BCrypt password hashing
- **User Profiles** — Custom avatars (upload or color picker), channel pages
- **Subscribe System** — Subscribe/unsubscribe to channels with toggle button
- **Comments & Replies** — Nested comments with @mentions, edit/delete support
- **Likes** — Like/dislike on videos
- **Playlists** — Create, edit, reorder, save playlists; playlist view history
- **Saved Videos** — Bookmark videos for later
- **Watch History** — Track which videos users watched
- **Search** — Full-text search with autocomplete suggestions and recent search history
- **Notifications** — Bell icon with unread count, subscribe/comment notifications
- **Admin Panel** — Dashboard with charts, user/video/report management, ban system
- **Video Preview** — Hover-to-preview (auto-play muted video on hover, YouTube-like)
- **Content Filtering** — Category chips, trending filter, entity filtering
- **Video Status Badges** — PENDING_AI, PROCESSING, PUBLISHED, REJECTED with visual indicators

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Spring Boot | 3.0.0 | Application framework |
| Spring Data JPA / Hibernate | (managed) | ORM, database access |
| Spring Kafka | 3.0.0 | Kafka producer/consumer |
| MySQL | 8.x (via XAMPP) | Relational database |
| Apache Kafka | (Confluent Docker) | Event message broker |
| JavaCV / FFmpeg | 1.5.9 | Video thumbnail extraction |
| JJWT | 0.11.5 | JWT token auth |
| Lombok | (managed) | Boilerplate reduction |
| Spring Security Crypto | (managed) | BCrypt password hashing |

### Frontend
| Technology | Purpose |
|------------|---------|
| HTML5, CSS3 | Structure and styling |
| Vanilla JavaScript | All frontend logic (no framework) |
| Chart.js | Admin dashboard charts |
| Fetch API | REST API communication |

### Infrastructure (Docker)
| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| Kafka | `confluentinc/cp-kafka` | 9092 | Message broker for async processing |
| Zookeeper | `confluentinc/cp-zookeeper` | 2181 | Kafka cluster coordination |
| MinIO | `minio/minio` | 9000 | S3-compatible object storage (configured but not wired) |

---

## Architecture Overview

### Understanding Docker vs Maven Dependencies

This is a key architectural concept:

| Docker Dependencies | Maven (pom.xml) Dependencies |
|---|---|
| **Runtime infrastructure** — separate processes running in containers | **Code libraries** — compiled INTO the Java application as JARs |
| Started with `docker-compose up` | Downloaded with `mvn install` |
| Examples: Kafka broker, Zookeeper, MinIO, MySQL | Examples: Spring Boot, Hibernate, `spring-kafka` client, JavaCV |
| Must be running BEFORE the app starts | Included in the classpath at compile time |

The `spring-kafka` dependency in pom.xml provides the **Java client library** (`KafkaTemplate`, `@KafkaListener`, `JsonSerializer`, etc.) that lets the application communicate with Kafka over the network. But **Kafka itself** (the actual message broker process) runs in Docker. Same relationship applies to all infrastructure dependencies.

### Kafka Event-Driven Pipeline

The system uses a **3-stage asynchronous pipeline** for processing uploaded videos:

```
Upload ──► video.uploaded ──► AI Analysis ──► video.approved ──► Processing ──► video.processed ──► Publish
              topic                             topic                              topic
```

**Stage 1 — Upload (`VideoController`):**
1. User uploads a video via `POST /api/videos/upload`
2. `ModerationService` checks title/description for profanity (regex + optional OpenAI)
3. `VideoContentClassifier` checks sports content (keywords + optional Gemini)
4. `VideoService.create()` saves DB record with status `PENDING_AI`
5. `KafkaTemplate.send("video.uploaded", event)` — produces event asynchronously
6. **Fallback:** If Kafka is unavailable, processes the video synchronously instead

**Stage 2 — AI Analysis (`AIConsumer` — listens to `video.uploaded`):**
1. Updates status to `AI_PROCESSING`
2. **Currently mocked** — always approves with label `"general_content"`, confidence 0.85
3. Produces `AIResultEvent` to `video.approved` topic

**Stage 3 — Processing (`ProcessorConsumer` — listens to `video.approved`):**
1. Updates status to `PROCESSING`
2. `StorageService.moveToPermanent()` — moves temp file to `uploads/videos/{id}/`
3. `VideoProcessingService.extractThumbnail()` — grabs frame at 2s via JavaCV/FFmpeg
4. `VideoService.updateProcessed()` — saves storage path and thumbnail path
5. Produces `ProcessedEvent` to `video.processed` topic

**Stage 4 — Publish (`ProcessorConsumer` — listens to `video.processed`):**
1. Sets status to `PUBLISHED`
2. Sets `publishedAt` timestamp
3. Video is now visible to all users

**Why Kafka?**
- **Decoupling** — Upload responds immediately; heavy processing happens later
- **Resilience** — Events persist in Kafka for retry on failure
- **Scalability** — Multiple consumer instances can process videos in parallel

### Authentication Flow

1. User registers or logs in at `/api/auth/login`
2. Server returns a **JWT token** (JSON Web Token) containing user ID and role
3. Frontend stores token in `localStorage` as `authToken`
4. Every API request includes `Authorization: Bearer <token>` header
5. Each controller validates the token manually via `authService.validateToken()`

> **Note:** There is no Spring Security filter chain. Authentication is handled manually in controllers.

---

## Prerequisites

- Java 17+
- Maven
- Docker Desktop
- XAMPP (MySQL on port 3307)
- FFmpeg (for thumbnail extraction — optional, JavaCV handles it)

---

## Setup & Run

### 1. Start infrastructure (Docker)

```bash
docker-compose up -d
```

This starts Kafka (port 9092), Zookeeper (port 2181), and MinIO (port 9000).

### 2. Start MySQL via XAMPP

Open XAMPP Control Panel → Start MySQL service (port 3307).

### 3. Create Kafka topics

```bash
docker exec -it kafka kafka-topics --create --topic video.uploaded --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec -it kafka kafka-topics --create --topic video.approved --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec -it kafka kafka-topics --create --topic video.processed --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
```

### 4. Run the application

```bash
mvn spring-boot:run
```

The app starts on `http://localhost:8080`. Hibernate's `ddl-auto=update` auto-creates the database tables.

### 5. Open browser

```
http://localhost:8080
```

---

## Project Structure

```
video-uploader/
├── src/main/java/com/videoplatform/video_uploader/
│   ├── VideoUploaderApplication.java       -- Entry point (@SpringBootApplication)
│   ├── controller/
│   │   ├── AuthController.java             -- /api/auth/* (register, login, profile, avatar)
│   │   ├── VideoController.java            -- /api/videos/* (upload, stream, comments, likes, search)
│   │   ├── AdminController.java            -- /api/admin/* (stats, reports, users, videos)
│   │   ├── SocialController.java           -- /api/* (subscribe, notifications, reports)
│   │   └── PlaylistController.java         -- /api/playlists/* (CRUD, items, save, history)
│   ├── service/
│   │   ├── AuthService.java                -- JWT generation/validation, BCrypt, registration
│   │   ├── VideoService.java               -- create, updateStatus, approve, reject, publish
│   │   ├── StorageService.java             -- local filesystem storage (temp, permanent, thumbnails)
│   │   ├── VideoProcessingService.java     -- JavaCV thumbnail extraction
│   │   ├── ModerationService.java          -- profanity filter + OpenAI Moderation API
│   │   ├── VideoContentClassifier.java     -- Gemini sports classification
│   │   ├── FrameExtractionService.java     -- extracts frames from video
│   │   ├── SportCategorizer.java           -- keyword-based sports category assignment
│   │   └── NotificationService.java        -- create/fetch/mark-read notifications
│   ├── model/
│   │   ├── Video.java, User.java, Comment.java, Like.java, VideoStatus.java (enum)
│   │   ├── Subscription.java, Notification.java, Report.java
│   │   ├── WatchHistory.java, SavedVideo.java
│   │   └── Playlist.java, PlaylistItem.java, SavedPlaylist.java, PlaylistHistory.java
│   ├── repository/                         -- Spring Data JPA repositories (14 interfaces)
│   ├── consumer/
│   │   ├── AIConsumer.java                 -- Kafka consumer for "video.uploaded" topic
│   │   └── ProcessorConsumer.java          -- Kafka consumer for "video.approved" / "video.processed"
│   ├── events/
│   │   ├── VideoUploadedEvent.java         -- Payload for video.uploaded topic
│   │   ├── AIResultEvent.java              -- Payload for video.approved topic
│   │   └── ProcessedEvent.java             -- Payload for video.processed topic
│   └── dto/                                -- UploadResponse, VideoStatusResponse
├── src/main/resources/
│   ├── static/
│   │   ├── index.html        -- Home page (Netflix-style grid)
│   │   ├── watch.html        -- Video player page
│   │   ├── search.html       -- Search results
│   │   ├── profile.html      -- User profile/channel
│   │   ├── admin.html        -- Admin dashboard
│   │   ├── playlist.html     -- Playlist detail
│   │   ├── library.html      -- User library
│   │   ├── login.html        -- Login/register
│   │   ├── css/style.css     -- Main stylesheet
│   │   ├── css/watch.css     -- Watch page styles
│   │   ├── js/app.js         -- Core frontend app
│   │   ├── js/watch.js       -- Watch page logic
│   │   └── js/admin.js       -- Admin panel logic
│   └── application.properties
├── docker-compose.yml          -- Kafka, Zookeeper, MinIO containers
├── pom.xml                     -- Maven dependencies
└── README.md
```

---

## API Endpoints Overview

### Auth (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login, returns JWT |
| GET | `/users/{id}` | Get user info |
| GET | `/users/search?q=` | Search users by username |
| PUT | `/users/profile` | Update avatar color |
| POST | `/users/avatar` | Upload avatar image |
| GET | `/users/{id}/avatar` | Serve avatar image |
| PUT | `/users/password` | Change password |
| DELETE | `/users/account` | Delete account |

### Videos (`/api/videos`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload` | Upload video (multipart) |
| GET | `/all` | List all videos |
| GET | `/{id}` | Get video metadata |
| GET | `/{id}/stream` | Stream video file |
| GET | `/{id}/thumbnail` | Serve thumbnail |
| GET | `/search?q=` | Search videos |
| GET | `/user/{userId}` | User's videos |
| DELETE | `/{id}` | Delete video |
| PUT | `/{id}/settings` | Update title/description/privacy |
| POST | `/{id}/like` | Toggle like |
| POST | `/{id}/dislike` | Toggle dislike |
| POST | `/{id}/comments` | Add comment |
| GET | `/{id}/comments` | Get comments |
| POST | `/{id}/watch` | Record watch |
| GET | `/history` | Watch history |
| POST | `/{id}/save` | Toggle save |
| GET | `/saved` | Saved videos |
| GET | `/recommendations` | Personalized recommendations |

### Social (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/channels/{id}/subscribe` | Toggle subscribe |
| GET | `/channels/{id}/subscribers` | Subscriber count |
| GET | `/channels/{id}/is-subscribed` | Check if subscribed |
| GET | `/channels/subscriptions` | User's subscriptions |
| GET | `/notifications` | Get notifications |
| POST | `/notifications/{id}/read` | Mark read |
| POST | `/videos/{id}/report` | Report video |

### Playlists (`/api/playlists`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create playlist |
| GET | `/user/{userId}` | User's playlists |
| GET | `/{id}` | Get playlist with videos |
| POST | `/{id}/videos` | Add video |
| DELETE | `/{id}/videos/{videoId}` | Remove video |
| POST | `/saved/{playlistId}` | Save playlist |
| GET | `/saved` | Saved playlists |
| POST | `/history/{playlistId}` | Record view |

### Admin (`/api/admin` — requires ADMIN role)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Platform stats |
| GET | `/stats/charts` | Chart data (30-day) |
| GET | `/reports` | List reports |
| POST | `/reports/{id}/resolve` | Resolve report |
| GET | `/users` | List all users |
| PUT | `/users/{id}/role` | Change role |
| POST | `/users/{id}/ban` | Toggle ban |
| GET | `/videos` | List all videos |
| DELETE | `/videos/{id}` | Admin delete video |
| PUT | `/videos/{id}/status` | Update status |

---

## Database Schema (14 Tables)

| Table | Key Entities |
|-------|-------------|
| `users` | id (UUID), username, email, password (BCrypt), role, avatar, isBanned |
| `videos` | id (UUID), userId, title, description, status (enum), storagePath, thumbnailPath, aiLabel, category, privacy |
| `comments` | id, videoId, userId, content, parentId (self-referencing for replies) |
| `likes` | id, videoId, userId, isLike — unique on (videoId, userId) |
| `subscriptions` | id, subscriberId, channelId, createdAt |
| `notifications` | id, userId, type, message, referenceId, isRead |
| `reports` | id, videoId, reporterId, reason, isResolved |
| `watch_history` | id, userId, videoId, videoTitle, watchedAt |
| `saved_videos` | id, userId, videoId, videoTitle — unique on (userId, videoId) |
| `playlists` | id, name, description, userId |
| `playlist_items` | id, playlistId, videoId, position |
| `saved_playlists` | id, userId, playlistId — unique on (userId, playlistId) |
| `playlist_history` | id, userId, playlistId, viewedAt |

`VideoStatus` enum: `PENDING_AI` → `AI_PROCESSING` → `APPROVED` → `PROCESSING` → `PUBLISHED` (or `REJECTED`)

---

## Key Design Decisions

| Decision | Implementation |
|----------|---------------|
| **AI is partially mocked** | The Kafka `AIConsumer` always approves. Real AI (OpenAI Moderation, Gemini classification) runs synchronously during upload. |
| **MinIO configured but not wired** | Docker container exists, but `StorageService` writes to local `uploads/` directory. |
| **No Spring Security** | JWT validation is manual in controllers — no filter chain or method-level security. |
| **Kafka fallback** | If Kafka send fails, the video processes synchronously (no event-driven pipeline). |
| **Local file storage** | Videos: `uploads/videos/{id}/`, thumbnails: `uploads/thumbnails/{id}.jpg` |
| **Max upload size** | 500MB |
| **Frontend** | Pure HTML/CSS/JS — no React, Vue, or Angular |
| **Duplicate event packages** | Two copies of `VideoUploadedEvent` exist (`events/` and `event/`); `events/` is the active one. |

---

## Notes

- The `application.properties` contains API keys for OpenAI, HuggingFace, and Gemini — these need to be valid for AI features to work fully.
- MySQL runs on port `3307` (non-standard) — ensure XAMPP is configured accordingly.
- Topics are created with 3 partitions each for parallel consumer processing.
