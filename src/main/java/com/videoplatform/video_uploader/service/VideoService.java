package com.videoplatform.video_uploader.service;


import com.videoplatform.video_uploader.model.Video;
import com.videoplatform.video_uploader.model.VideoStatus;
import com.videoplatform.video_uploader.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class VideoService {

    private final VideoRepository videoRepository;
    private final SportCategorizer sportCategorizer;

    @Transactional
    public Video create(UUID userId, String originalFilename, String tempPath, String title, String description, String privacy) {
        Video video = new Video();
        video.setUserId(userId);
        video.setOriginalFilename(originalFilename);
        video.setStoragePath(tempPath);
        video.setStatus(VideoStatus.PENDING_AI);
        video.setTitle(title);
        if (description != null && !description.isBlank()) {
            video.setDescription(description);
        }
        if (privacy != null && !privacy.isBlank()) {
            video.setPrivacy(privacy);
        }
        video.setCategory(sportCategorizer.categorize(title, description));
        return videoRepository.save(video);
    }

    @Transactional
    public void updateStatus(UUID videoId, VideoStatus status) {
        Video video = videoRepository.findById(videoId).orElseThrow();
        video.setStatus(status);
        videoRepository.save(video);
        log.info("Video {} status updated to {}", videoId, status);
    }

    @Transactional
    public void rejectVideo(UUID videoId, String reason) {
        Video video = videoRepository.findById(videoId).orElseThrow();
        video.setStatus(VideoStatus.REJECTED);
        video.setRejectionReason(reason);
        videoRepository.save(video);
        log.info("Video {} rejected: {}", videoId, reason);
    }

    @Transactional
    public void approveVideo(UUID videoId, String label, Double confidence) {
        Video video = videoRepository.findById(videoId).orElseThrow();
        video.setStatus(VideoStatus.APPROVED);
        video.setAiLabel(label);
        video.setAiConfidence(confidence);
        videoRepository.save(video);
        log.info("Video {} approved as {} (confidence: {})", videoId, label, confidence);
    }

    @Transactional
    public void updateProcessed(UUID videoId, String permanentPath, String thumbnailPath) {
        Video video = videoRepository.findById(videoId).orElseThrow();
        video.setStoragePath(permanentPath);
        video.setThumbnailPath(thumbnailPath);
        video.setStatus(VideoStatus.PROCESSING);
        videoRepository.save(video);
    }

    @Transactional
    public void publish(UUID videoId) {
        Video video = videoRepository.findById(videoId).orElseThrow();
        video.setStatus(VideoStatus.PUBLISHED);
        video.setPublishedAt(LocalDateTime.now());
        videoRepository.save(video);
        log.info("Video {} published", videoId);
    }

    public Video getVideo(UUID videoId) {
        return videoRepository.findById(videoId).orElseThrow();
    }

    @Transactional
    public Video updateVideoSettings(UUID videoId, String title, String description, String privacy) {
        Video video = videoRepository.findById(videoId).orElseThrow();
        if (title != null) video.setTitle(title);
        if (description != null) video.setDescription(description);
        if (privacy != null) video.setPrivacy(privacy);
        video.setCategory(sportCategorizer.categorize(video.getTitle(), video.getDescription()));
        return videoRepository.save(video);
    }
}