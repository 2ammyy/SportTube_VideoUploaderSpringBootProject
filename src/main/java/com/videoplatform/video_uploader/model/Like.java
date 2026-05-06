package com.videoplatform.video_uploader.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.UUID;

@Entity
@Table(name = "likes", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"video_id", "user_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Like {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "video_id", nullable = false)
    private UUID videoId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    private boolean isLike; // true = like, false = dislike
}