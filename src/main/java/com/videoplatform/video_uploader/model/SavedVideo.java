package com.videoplatform.video_uploader.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "saved_videos", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "video_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SavedVideo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "video_id", nullable = false)
    private UUID videoId;

    @Column(length = 500)
    private String videoTitle;

    private LocalDateTime savedAt;

    @PrePersist
    protected void onCreate() {
        savedAt = LocalDateTime.now();
    }
}
