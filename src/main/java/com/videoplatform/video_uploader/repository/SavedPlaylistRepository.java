package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.SavedPlaylist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SavedPlaylistRepository extends JpaRepository<SavedPlaylist, UUID> {
    List<SavedPlaylist> findByUserIdOrderBySavedAtDesc(UUID userId);
    Optional<SavedPlaylist> findByUserIdAndPlaylistId(UUID userId, UUID playlistId);
    boolean existsByUserIdAndPlaylistId(UUID userId, UUID playlistId);
    void deleteByPlaylistId(UUID playlistId);
}
