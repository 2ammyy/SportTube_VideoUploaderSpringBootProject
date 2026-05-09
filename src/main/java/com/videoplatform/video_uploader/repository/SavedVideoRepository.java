package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.SavedVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SavedVideoRepository extends JpaRepository<SavedVideo, UUID> {
    List<SavedVideo> findByUserIdOrderBySavedAtDesc(UUID userId);
    Optional<SavedVideo> findByUserIdAndVideoId(UUID userId, UUID videoId);
    boolean existsByUserIdAndVideoId(UUID userId, UUID videoId);
}
