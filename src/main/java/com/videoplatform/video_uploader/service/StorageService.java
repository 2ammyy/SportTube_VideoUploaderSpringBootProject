package com.videoplatform.video_uploader.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.UUID;

@Service
@Slf4j
public class StorageService {

    private final Path tempLocation = Paths.get("uploads/temp");
    private final Path permanentLocation = Paths.get("uploads/videos");
    private final Path thumbnailLocation = Paths.get("uploads/thumbnails");

    @PostConstruct
    public void init() throws IOException {
        Files.createDirectories(tempLocation);
        Files.createDirectories(permanentLocation);
        Files.createDirectories(thumbnailLocation);
        log.info("Storage directories initialized at: {}", Paths.get("uploads").toAbsolutePath());
    }

    public String uploadTemp(MultipartFile file) throws IOException {
        String filename = UUID.randomUUID() + "_" + sanitizeFilename(file.getOriginalFilename());
        Path target = tempLocation.resolve(filename);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        log.info("Uploaded temp file: {}", target.toAbsolutePath());
        return target.toString();
    }

    public InputStream download(String path) throws IOException {
        return Files.newInputStream(Paths.get(path));
    }

    public String moveToPermanent(String tempPath, String videoId) throws IOException {
        Path source = Paths.get(tempPath);
        if (!Files.exists(source)) {
            log.error("Source file not found: {}", tempPath);
            return tempPath;
        }

        String filename = source.getFileName().toString();
        Path videoDir = permanentLocation.resolve(videoId);
        Files.createDirectories(videoDir);
        Path target = videoDir.resolve(filename);
        Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        log.info("Moved to permanent: {}", target.toAbsolutePath());
        return target.toString();
    }

    public void uploadThumbnail(String path, byte[] data) throws IOException {
        Path target = thumbnailLocation.resolve(path);
        Files.createDirectories(target.getParent());
        Files.write(target, data);
        log.info("Uploaded thumbnail: {}", target.toAbsolutePath());
    }

    public String getVideoUrl(String videoPath) {
        // Extract just the filename for streaming
        Path path = Paths.get(videoPath);
        return "/api/videos/stream/" + path.getFileName().toString();
    }

    public String getUploadDir() {
        return Paths.get("uploads").toAbsolutePath().toString();
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) return "unknown";
        // Remove any path traversal characters
        String sanitized = filename.replaceAll("[^a-zA-Z0-9.-]", "_");
        // Ensure it's not too long
        if (sanitized.length() > 100) {
            String extension = "";
            int dotIndex = sanitized.lastIndexOf('.');
            if (dotIndex > 0) {
                extension = sanitized.substring(dotIndex);
                sanitized = sanitized.substring(0, 97);
            }
            sanitized = sanitized.substring(0, Math.min(97, sanitized.length())) + extension;
        }
        return sanitized;
    }
}