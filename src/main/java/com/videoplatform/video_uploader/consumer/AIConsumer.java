package com.videoplatform.video_uploader.consumer;

import com.videoplatform.video_uploader.events.AIResultEvent;
import com.videoplatform.video_uploader.events.VideoUploadedEvent;
import com.videoplatform.video_uploader.model.VideoStatus;
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
public class AIConsumer {

    private final VideoService videoService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(topics = "video.uploaded", groupId = "ai-group")
    public void analyzeVideo(VideoUploadedEvent event) {
        UUID videoId = event.getVideoId();
        log.info("Analyzing video: {}", videoId);

        try {
            // Update status to AI_PROCESSING
            videoService.updateStatus(videoId, VideoStatus.AI_PROCESSING);
            log.info("Video {} status updated to AI_PROCESSING", videoId);

            // MOCK AI DECISION (will replace with real AI later)
            // For now, approve all videos with a general label
            boolean isAppropriate = true;  // Mock decision
            String label = "general_content";
            Double confidence = 0.85;

            if (isAppropriate) {
                // Approve
                videoService.approveVideo(videoId, label, confidence);
                log.info("Video {} approved with label: {}", videoId, label);

                AIResultEvent resultEvent = new AIResultEvent(
                        videoId,
                        "APPROVED",
                        label,
                        confidence,
                        null
                );
                kafkaTemplate.send("video.approved", videoId.toString(), resultEvent);
                log.info("Video {} sent to video.approved topic", videoId);

            } else {
                // Reject
                String reason = "Content does not meet platform guidelines";
                videoService.rejectVideo(videoId, reason);

                AIResultEvent resultEvent = new AIResultEvent(
                        videoId,
                        "REJECTED",
                        null,
                        confidence,
                        reason
                );
                kafkaTemplate.send("video.approved", videoId.toString(), resultEvent);
                log.info("Video {} REJECTED: {}", videoId, reason);
            }
        } catch (Exception e) {
            log.error("Error processing video {}: {}", videoId, e.getMessage(), e);
        }
    }
}