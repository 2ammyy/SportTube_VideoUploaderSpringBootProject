package com.videoplatform.video_uploader.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "BINARY(16)")
    private UUID id;

    @Column(nullable = false, columnDefinition = "BINARY(16)")
    private UUID userId;  // User who receives the notification

    @Column(nullable = false, columnDefinition = "BINARY(16)")
    private UUID triggeredBy;  // User who triggered the action

    @Column(nullable = false, length = 50)
    private String type;  // SUBSCRIBE, VIDEO_UPLOAD, LIKE, COMMENT

    @Column(nullable = false, columnDefinition = "BINARY(16)")
    private UUID videoId;  // Related video (if any)

    @Column(length = 500)
    private String message;

    @Column(nullable = false)
    private boolean isRead = false;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
