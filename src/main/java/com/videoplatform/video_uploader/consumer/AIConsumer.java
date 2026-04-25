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

        // Update status to AI_PROCESSING
        videoService.updateStatus(videoId, VideoStatus.AI_PROCESSING);

        // MOCK AI DECISION (will replace with real AI later)
        // For now, approve all videos with a general label
        boolean isAppropriate = true;  // Mock decision
        String label = "general_content";
        Double confidence = 0.85;

        if (isAppropriate) {
            // Approve
            videoService.approveVideo(videoId, label, confidence);

            AIResultEvent resultEvent = new AIResultEvent(
                    videoId,
                    "APPROVED",
                    label,
                    confidence,
                    null
            );
            kafkaTemplate.send("video.ai.results", videoId.toString(), resultEvent);
            log.info("Video {} APPROVED", videoId);

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
            kafkaTemplate.send("video.ai.results", videoId.toString(), resultEvent);
            log.info("Video {} REJECTED: {}", videoId, reason);
        }
    }
}