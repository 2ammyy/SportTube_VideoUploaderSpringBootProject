package com.videoplatform.video_uploader.consumer;

import com.videoplatform.video_uploader.events.AIResultEvent;
import com.videoplatform.video_uploader.events.ProcessedEvent;
import com.videoplatform.video_uploader.model.Video;
import com.videoplatform.video_uploader.model.VideoStatus;
import com.videoplatform.video_uploader.repository.VideoRepository;
import com.videoplatform.video_uploader.service.StorageService;
import com.videoplatform.video_uploader.service.VideoProcessingService;
import com.videoplatform.video_uploader.service.VideoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProcessorConsumer {

    private final VideoService videoService;
    private final VideoRepository videoRepository;
    private final StorageService storageService;
    private final VideoProcessingService videoProcessingService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(topics = "video.approved", groupId = "processor-group")
    public void processVideo(AIResultEvent event) {
        try {
            UUID videoId = event.getVideoId();
            log.info("Processing approved video: {}", videoId);

            // Get the video from database
            Video video = videoRepository.findById(videoId).orElse(null);
            if (video == null) {
                log.error("Video not found: {}", videoId);
                return;
            }

            // Update status to PROCESSING
            videoService.updateStatus(videoId, VideoStatus.PROCESSING);

            // Get the temp path and move to permanent storage
            String tempPath = video.getStoragePath();
            String permanentPath = storageService.moveToPermanent(tempPath, videoId.toString());

            // Extract thumbnail from video
            log.info("Extracting thumbnail for video: {}", videoId);
            String thumbnailPath = videoProcessingService.extractThumbnail(permanentPath, videoId);

            // Update video with permanent path and thumbnail
            videoService.updateProcessed(videoId, permanentPath, thumbnailPath);

            // Send to next topic
            ProcessedEvent processedEvent = new ProcessedEvent(videoId, permanentPath, thumbnailPath);
            kafkaTemplate.send("video.processed", videoId.toString(), processedEvent);

            log.info("Video {} processing complete. Thumbnail: {}", videoId, thumbnailPath);

        } catch (Exception e) {
            log.error("Error processing video: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "video.processed", groupId = "publish-group")
    public void publishVideo(ProcessedEvent event) {
        log.info("Publishing video: {}", event.getVideoId());
        videoService.publish(event.getVideoId());
        log.info("Video {} published successfully", event.getVideoId());
    }
}