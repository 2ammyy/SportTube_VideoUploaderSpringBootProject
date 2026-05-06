package com.videoplatform.video_uploader.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.bytedeco.javacv.Frame;
import org.bytedeco.javacv.Java2DFrameConverter;
import org.springframework.stereotype.Service;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class VideoProcessingService {

    private final StorageService storageService;

    public String extractThumbnail(String videoPath, UUID videoId) {
        try {
            // Create thumbnails directory
            String thumbnailDir = storageService.getUploadDir() + "/thumbnails";
            File dir = new File(thumbnailDir);
            if (!dir.exists()) dir.mkdirs();

            String thumbnailPath = thumbnailDir + "/" + videoId + "_thumb.jpg";
            
            // Use JavaCV (FFmpeg) to grab frame at 2 seconds
            try (FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoPath)) {
                grabber.start();
                
                // Seek to 2 seconds (or middle of video if shorter)
                double duration = grabber.getLengthInTime() / 1000000.0; // Convert to seconds
                double seekTime = Math.min(2.0, duration / 2.0);
                grabber.setTimestamp((long) (seekTime * 1000000));
                
                // Grab frame
                Frame frame = grabber.grabImage();
                if (frame != null) {
                    Java2DFrameConverter converter = new Java2DFrameConverter();
                    BufferedImage bufferedImage = converter.convert(frame);
                    
                    if (bufferedImage != null) {
                        // Save as JPEG
                        ImageIO.write(bufferedImage, "jpg", new File(thumbnailPath));
                        log.info("Thumbnail extracted successfully: {}", thumbnailPath);
                        return thumbnailPath;
                    }
                }
                grabber.stop();
            }
            
            log.warn("Could not extract thumbnail for video: {}", videoId);
            return null;
            
        } catch (Exception e) {
            log.error("Error extracting thumbnail: {}", e.getMessage(), e);
            return null;
        }
    }
}