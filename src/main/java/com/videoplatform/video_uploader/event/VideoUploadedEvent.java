package com.videoplatform.video_uploader.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VideoUploadedEvent {
    private UUID videoId;
    private String tempPath;
    private long fileSize;
    private String contentType;
}
