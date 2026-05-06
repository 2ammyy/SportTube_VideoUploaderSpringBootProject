package com.videoplatform.video_uploader.controller;

import com.videoplatform.video_uploader.dto.UploadResponse;
import com.videoplatform.video_uploader.dto.VideoStatusResponse;
import com.videoplatform.video_uploader.events.VideoUploadedEvent;
import com.videoplatform.video_uploader.model.Comment;
import com.videoplatform.video_uploader.model.Like;
import com.videoplatform.video_uploader.model.Video;
import com.videoplatform.video_uploader.repository.CommentRepository;
import com.videoplatform.video_uploader.repository.LikeRepository;
import com.videoplatform.video_uploader.repository.VideoRepository;
import com.videoplatform.video_uploader.service.AuthService;
import com.videoplatform.video_uploader.service.StorageService;
import com.videoplatform.video_uploader.service.VideoProcessingService;
import com.videoplatform.video_uploader.service.VideoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import java.util.ArrayList;
import java.util.HashMap;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
@Slf4j
public class VideoController {

    private final VideoService videoService;
    private final StorageService storageService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final VideoRepository videoRepository;
    private final CommentRepository commentRepository;
    private final LikeRepository likeRepository;
    private final VideoProcessingService videoProcessingService;
    private final AuthService authService;

    @PostMapping("/upload")
    public ResponseEntity<UploadResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("userId") UUID userId) {

        try {
            // 1. Save temp file to storage
            String tempPath = storageService.uploadTemp(file);

            // 2. Create database record
            Video video = videoService.create(userId, file.getOriginalFilename(), tempPath);

            // 3. Send event to Kafka
            VideoUploadedEvent event = new VideoUploadedEvent(
                    video.getId(),
                    tempPath,
                    file.getSize(),
                    file.getContentType()
            );
            kafkaTemplate.send("video.uploaded", video.getId().toString(), event);

            // 4. Return response
            return ResponseEntity.ok(new UploadResponse(
                    video.getId(),
                    "PENDING_AI",
                    "Video uploaded successfully. AI analysis in progress."
            ));

        } catch (Exception e) {
            log.error("Upload error: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<VideoStatusResponse> getStatus(@PathVariable UUID id) {
        try {
            Video video = videoService.getVideo(id);
            return ResponseEntity.ok(new VideoStatusResponse(
                    video.getId(),
                    video.getStatus().toString(),
                    video.getAiLabel(),
                    video.getRejectionReason()
            ));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Video> getVideo(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(videoService.getVideo(id));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/all")
    public ResponseEntity<List<Video>> getAllVideos() {
        try {
            List<Video> videos = videoRepository.findAll();
            return ResponseEntity.ok(videos);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // ============ LIKES ENDPOINTS ============

    @PostMapping("/{id}/like")
    public ResponseEntity<?> likeVideo(@PathVariable UUID id, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            Optional<Like> existingLike = likeRepository.findByVideoIdAndUserId(id, userId);

            if (existingLike.isPresent()) {
                Like like = existingLike.get();
                like.setLike(true);
                likeRepository.save(like);
            } else {
                Like like = new Like();
                like.setVideoId(id);
                like.setUserId(userId);
                like.setLike(true);
                likeRepository.save(like);
            }
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/dislike")
    public ResponseEntity<?> dislikeVideo(@PathVariable UUID id, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            Optional<Like> existingLike = likeRepository.findByVideoIdAndUserId(id, userId);

            if (existingLike.isPresent()) {
                Like like = existingLike.get();
                like.setLike(false);
                likeRepository.save(like);
            } else {
                Like like = new Like();
                like.setVideoId(id);
                like.setUserId(userId);
                like.setLike(false);
                likeRepository.save(like);
            }
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{id}/likes")
    public ResponseEntity<?> getLikes(@PathVariable UUID id) {
        long likes = likeRepository.countByVideoIdAndIsLikeTrue(id);
        long dislikes = likeRepository.countByVideoIdAndIsLikeFalse(id);
        return ResponseEntity.ok(Map.of("likes", likes, "dislikes", dislikes));
    }

    // ============ COMMENTS ENDPOINTS ============

    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(@PathVariable UUID id, @RequestBody Map<String, String> request, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            Comment comment = new Comment();
            comment.setVideoId(id);
            comment.setUserId(userId);
            comment.setContent(request.get("content"));
            commentRepository.save(comment);
            return ResponseEntity.ok(comment);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<?> getComments(@PathVariable UUID id) {
        List<Comment> comments = commentRepository.findByVideoIdOrderByCreatedAtDesc(id);
        return ResponseEntity.ok(comments);
    }

    // ============ STREAMING ENDPOINT ============

    @GetMapping("/{id}/thumbnail")
    public ResponseEntity<Resource> getThumbnail(@PathVariable UUID id) {
        try {
            Video video = videoService.getVideo(id);
            String thumbnailPath = video.getThumbnailPath();

            if (thumbnailPath == null || thumbnailPath.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Path filePath = Paths.get(thumbnailPath);

            // If thumbnail doesn't exist, try to find it
            if (!Files.exists(filePath)) {
                File thumbnailsDir = new File(storageService.getUploadDir() + "/thumbnails");
                if (thumbnailsDir.exists()) {
                    File[] files = thumbnailsDir.listFiles((dir, name) -> name.contains(id.toString()));
                    if (files != null && files.length > 0) {
                        filePath = files[0].toPath();
                    }
                }
            }

            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new UrlResource(filePath.toUri());

            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = "image/jpeg";
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                    .body(resource);

        } catch (Exception e) {
            log.error("Error serving thumbnail: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/stream")
    public ResponseEntity<Resource> streamVideo(@PathVariable UUID id) {
        try {
            Video video = videoService.getVideo(id);
            String storagePath = video.getStoragePath();

            log.info("Streaming video - ID: {}, Storage path: {}", id, storagePath);

            if (storagePath == null || storagePath.isEmpty()) {
                log.error("Storage path is null or empty for video: {}", id);
                return ResponseEntity.notFound().build();
            }

            Path filePath = Paths.get(storagePath);

            // If the path doesn't exist, try to find it in the uploads directory
            if (!Files.exists(filePath)) {
                log.warn("File not found at: {}, searching in uploads directory...", filePath);

                // Search in permanent location
                Path searchPath = Paths.get("uploads/videos");
                if (Files.exists(searchPath)) {
                    try (var stream = Files.walk(searchPath)) {
                        filePath = stream
                                .filter(Files::isRegularFile)
                                .filter(path -> path.toString().contains(video.getId().toString()))
                                .findFirst()
                                .orElse(null);

                        if (filePath != null && Files.exists(filePath)) {
                            log.info("Found video file at: {}", filePath);
                        } else {
                            log.error("Could not find video file for ID: {}", id);
                            return ResponseEntity.notFound().build();
                        }
                    }
                } else {
                    log.error("Uploads directory not found");
                    return ResponseEntity.notFound().build();
                }
            }

            // Verify file exists and is readable
            if (!Files.exists(filePath) || !Files.isReadable(filePath)) {
                log.error("File not readable or does not exist: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            Resource resource = new UrlResource(filePath.toUri());

            // Determine content type
            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = "video/mp4";
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                    .body(resource);

        } catch (Exception e) {
            log.error("Error streaming video: {}", e.getMessage(), e);
            return ResponseEntity.notFound().build();
        }
    }
    @GetMapping("/debug/files")
    public ResponseEntity<?> listFiles() {
        try {
            Path uploadsDir = Paths.get("uploads");
            if (!Files.exists(uploadsDir)) {
                return ResponseEntity.ok(Map.of("error", "Uploads directory does not exist"));
            }

            List<Map<String, String>> files = new ArrayList<>();
            try (var stream = Files.walk(uploadsDir)) {
                stream.filter(Files::isRegularFile)
                        .forEach(path -> {
                            Map<String, String> fileInfo = new HashMap<>();
                            fileInfo.put("path", path.toString());
                            fileInfo.put("size", String.valueOf(path.toFile().length()));
                            files.add(fileInfo);
                        });
            }

            return ResponseEntity.ok(Map.of(
                    "uploads_directory", uploadsDir.toAbsolutePath().toString(),
                    "files", files
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }
}