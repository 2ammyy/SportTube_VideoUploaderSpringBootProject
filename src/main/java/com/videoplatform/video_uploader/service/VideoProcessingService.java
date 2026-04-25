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
import java.io.InputStream;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class VideoProcessingService {

    private final StorageService storageService;

    public String extractThumbnail(String videoPath, UUID videoId) throws Exception {
        // Download video temporarily
        InputStream videoStream = storageService.download(videoPath);

        // Use FFmpeg to extract first frame
        FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(videoStream);
        grabber.start();

        Frame frame = grabber.grabImage();
        Java2DFrameConverter converter = new Java2DFrameConverter();
        BufferedImage bufferedImage = converter.convert(frame);

        // Convert to PNG bytes
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(bufferedImage, "png", baos);
        byte[] thumbnailBytes = baos.toByteArray();

        grabber.stop();

        // Upload thumbnail to MinIO
        String thumbnailPath = "thumbnails/" + videoId + ".png";
        storageService.uploadThumbnail(thumbnailPath, thumbnailBytes);

        log.info("Thumbnail extracted for video: {}", videoId);
        return thumbnailPath;
    }
}