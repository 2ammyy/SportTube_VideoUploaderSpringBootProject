package com.videoplatform.video_uploader.controller;

import com.videoplatform.video_uploader.dto.UploadResponse;
import com.videoplatform.video_uploader.dto.VideoStatusResponse;
import com.videoplatform.video_uploader.events.VideoUploadedEvent;
import com.videoplatform.video_uploader.model.Video;
import com.videoplatform.video_uploader.repository.VideoRepository;
import com.videoplatform.video_uploader.service.AuthService;
import com.videoplatform.video_uploader.service.StorageService;
import com.videoplatform.video_uploader.service.VideoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.videoplatform.video_uploader.model.Comment;
import com.videoplatform.video_uploader.model.Like;
import com.videoplatform.video_uploader.repository.CommentRepository;
import com.videoplatform.video_uploader.repository.LikeRepository;
import com.videoplatform.video_uploader.service.VideoProcessingService;
import org.springframework.web.bind.annotation.RequestHeader;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
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
            // 1. Save temp file to MinIO
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
            e.printStackTrace();
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

    // ADD THIS NEW ENDPOINT
    @GetMapping("/all")
    public ResponseEntity<List<Video>> getAllVideos() {
        try {
            List<Video> videos = videoRepository.findAll();
            return ResponseEntity.ok(videos);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Video>> getVideosByUser(@PathVariable UUID userId) {
        try {
            List<Video> videos = videoRepository.findByUserId(userId);
            return ResponseEntity.ok(videos);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
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

    @GetMapping("/{id}/stream")
    public ResponseEntity<?> streamVideo(@PathVariable UUID id) {
        try {
            Video video = videoService.getVideo(id);
            String videoUrl = storageService.getVideoUrl(video.getStoragePath());
            return ResponseEntity.ok(Map.of("url", videoUrl));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}