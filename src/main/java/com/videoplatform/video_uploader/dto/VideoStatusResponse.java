package com.videoplatform.video_uploader.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.UUID;

@Data
@AllArgsConstructor
public class VideoStatusResponse {
    private UUID videoId;
    private String status;
    private String aiLabel;
    private String rejectionReason;
}