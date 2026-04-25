package com.videoplatform.video_uploader.events;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessedEvent implements Serializable {
    private UUID videoId;
    private String permanentPath;
    private String thumbnailPath;
}