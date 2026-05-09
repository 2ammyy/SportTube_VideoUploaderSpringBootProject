package com.videoplatform.video_uploader.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "watch_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WatchHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private UUID videoId;

    @Column(nullable = false, length = 500)
    private String videoTitle;

    private LocalDateTime watchedAt;

    @PrePersist
    protected void onCreate() {
        watchedAt = LocalDateTime.now();
    }
}
