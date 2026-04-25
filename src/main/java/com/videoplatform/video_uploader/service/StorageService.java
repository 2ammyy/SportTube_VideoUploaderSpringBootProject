package com.videoplatform.video_uploader.service;

import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class StorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket-name}")
    private String bucketName;

    public String uploadTemp(MultipartFile file) throws Exception {
        // Ensure bucket exists
        boolean found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build());
        if (!found) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
            log.info("Created bucket: {}", bucketName);
        }

        String objectName = "temp/" + UUID.randomUUID() + "_" + file.getOriginalFilename();

        minioClient.putObject(PutObjectArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .stream(file.getInputStream(), file.getSize(), -1)
                .contentType(file.getContentType())
                .build());

        log.info("Uploaded temp file: {}", objectName);
        return objectName;
    }

    public InputStream download(String path) throws Exception {
        return minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucketName)
                .object(path)
                .build());
    }

    public String moveToPermanent(String tempPath, String videoId) throws Exception {
        String permanentPath = "videos/" + videoId + "/" + tempPath.substring(tempPath.lastIndexOf("_") + 1);

        // Copy object
        minioClient.copyObject(CopyObjectArgs.builder()
                .bucket(bucketName)
                .object(permanentPath)
                .source(CopySource.builder()
                        .bucket(bucketName)
                        .object(tempPath)
                        .build())
                .build());

        // Delete temp
        minioClient.removeObject(RemoveObjectArgs.builder()
                .bucket(bucketName)
                .object(tempPath)
                .build());

        log.info("Moved to permanent: {}", permanentPath);
        return permanentPath;
    }

    // ADD THIS METHOD - for uploading thumbnails
    public void uploadThumbnail(String path, byte[] data) throws Exception {
        minioClient.putObject(PutObjectArgs.builder()
                .bucket(bucketName)
                .object(path)
                .stream(new ByteArrayInputStream(data), data.length, -1)
                .contentType("image/png")
                .build());
        log.info("Uploaded thumbnail: {}", path);
    }

    // ADD THIS METHOD - for getting video stream URL
    public String getVideoUrl(String videoPath) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(bucketName)
                            .object(videoPath)
                            .method(Method.GET)
                            .expiry(60 * 60) // 1 hour
                            .build()
            );
        } catch (Exception e) {
            log.error("Error generating URL: {}", e.getMessage());
            return null;
        }
    }
}