package com.videoplatform.video_uploader.consumer;


import com.videoplatform.video_uploader.events.AIResultEvent;
import com.videoplatform.video_uploader.events.ProcessedEvent;
import com.videoplatform.video_uploader.service.StorageService;
import com.videoplatform.video_uploader.service.VideoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProcessorConsumer {

    private final VideoService videoService;
    private final StorageService storageService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(topics = "video.approved", groupId = "processor-group")
    public void processVideo(AIResultEvent event) {
        try {
            log.info("Processing approved video: {}", event.getVideoId());

            // Note: You need to get the actual temp path from the video record
            // For now, we'll use a simplified version
            // In production, fetch the video entity first

            // Generate thumbnail placeholder
            String thumbnailPath = "thumbnails/" + event.getVideoId() + ".jpg";

            // Update video record (you would move the file here)
            videoService.updateProcessed(event.getVideoId(), "processed_path", thumbnailPath);

            ProcessedEvent processedEvent = new ProcessedEvent(
                    event.getVideoId(),
                    "processed_path",
                    thumbnailPath
            );

            kafkaTemplate.send("video.processed", event.getVideoId().toString(), processedEvent);
            log.info("Video {} processing complete", event.getVideoId());

        } catch (Exception e) {
            log.error("Error processing video: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "video.processed", groupId = "publish-group")
    public void publishVideo(ProcessedEvent event) {
        log.info("Publishing video: {}", event.getVideoId());
        videoService.publish(event.getVideoId());
        kafkaTemplate.send("video.published", event.getVideoId().toString(), event);
        log.info("Video {} published successfully", event.getVideoId());
    }
}