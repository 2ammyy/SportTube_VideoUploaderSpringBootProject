package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.PlaylistHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface PlaylistHistoryRepository extends JpaRepository<PlaylistHistory, UUID> {
    List<PlaylistHistory> findByUserIdOrderByViewedAtDesc(UUID userId);
    boolean existsByUserIdAndPlaylistId(UUID userId, UUID playlistId);
    void deleteByPlaylistId(UUID playlistId);
}
