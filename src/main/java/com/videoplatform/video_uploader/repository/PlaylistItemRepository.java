package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.PlaylistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlaylistItemRepository extends JpaRepository<PlaylistItem, UUID> {
    List<PlaylistItem> findByPlaylistIdOrderByPositionAsc(UUID playlistId);
    Optional<PlaylistItem> findByPlaylistIdAndVideoId(UUID playlistId, UUID videoId);
    int countByPlaylistId(UUID playlistId);
    void deleteByPlaylistId(UUID playlistId);
}
