package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.WatchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WatchHistoryRepository extends JpaRepository<WatchHistory, UUID> {
    List<WatchHistory> findByUserIdOrderByWatchedAtDesc(UUID userId);
    Optional<WatchHistory> findByUserIdAndVideoId(UUID userId, UUID videoId);
}
