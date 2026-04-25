# 🎬 VideoStream - Event-Driven Video Upload Platform

A **production-ready video platform** built with **Spring Boot**, **Kafka**, **AI**, and **MinIO**. Features include video upload, AI-powered content moderation, real-time processing, user authentication, comments, likes, and a Netflix-style interface.

## ✨ Features

- 🚀 **Event-Driven Architecture** with Apache Kafka
- 🤖 **AI-Powered Content Moderation** (mock AI ready for integration)
- 🎨 **Netflix-Style UI** with hover effects and modal player
- 🔐 **User Authentication** with JWT
- 💬 **Comments & Likes System**
- 🎬 **Video Streaming** from MinIO
- 📸 **Thumbnail Extraction** (FFmpeg integration)
- 🔍 **Search & Categories** (Trending, All Videos)
- 👤 **User Profiles** with avatars
- 📱 **Responsive Design**

## 🛠️ Tech Stack

- **Backend**: Spring Boot 3.2.x, Java 17
- **Message Queue**: Apache Kafka
- **Database**: MySQL (XAMPP)
- **Storage**: MinIO (S3-compatible)
- **Frontend**: HTML5, CSS3, JavaScript
- **Authentication**: JWT
- **Video Processing**: FFmpeg, JavaCV
- **Container**: Docker (Kafka, Zookeeper, MinIO)

## 📋 Prerequisites

- Java 17+
- Maven
- Docker Desktop
- XAMPP (MySQL)
- FFmpeg (for thumbnail extraction)

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/video-uploader.git
cd video-uploader
```

### 2. Start dependencies with Docker

```bash
docker-compose up -d
```

### 3. Start MySQL via XAMPP
- Open XAMPP Control Panel
- Start MySQL service

### 4. Create Kafka topics


```bash
docker exec -it kafka kafka-topics --create --topic video.uploaded --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec -it kafka kafka-topics --create --topic video.ai.results --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec -it kafka kafka-topics --create --topic video.approved --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec -it kafka kafka-topics --create --topic video.rejected --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec -it kafka kafka-topics --create --topic video.processed --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec -it kafka kafka-topics --create --topic video.published --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
```
### 5. Configure application

```bash
cp src/main/resources/application-sample.properties src/main/resources/application.properties
# Edit application.properties with your database credentials
```

### 6. Run the application

```bash
mvn spring-boot:run
```

### 7. Open browser

```bash
http://localhost:8080
```



## 📁 Project Structure

video-uploader/
├── src/main/java/com/videoplatform/video_uploader/
│   ├── controller/      # REST endpoints
│   ├── service/         # Business logic
│   ├── model/           # Entities
│   ├── repository/      # Data access
│   ├── consumer/        # Kafka consumers
│   ├── producer/        # Kafka producers
│   ├── config/          # Configuration
│   ├── dto/             # Data transfer objects
│   └── events/          # Event classes
├── src/main/resources/
│   ├── static/          # Frontend (HTML/CSS/JS)
│   └── application.properties
├── docker-compose.yml
└── pom.xml

## 🔄 Event Flow
- Upload → Kafka (video.uploaded) → AI Consumer →
- Approved → Kafka (video.approved) → Processor →
- Processed → Kafka (video.processed) → Publisher → Published
