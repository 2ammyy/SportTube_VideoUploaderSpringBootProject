package com.videoplatform.video_uploader.events;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIResultEvent implements Serializable {
    private UUID videoId;
    private String decision;  // APPROVED or REJECTED
    private String label;
    private Double confidence;
    private String rejectionReason;
}