package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.Playlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, UUID> {
    List<Playlist> findByUserIdOrderByUpdatedAtDesc(UUID userId);
    long countByUserId(UUID userId);
}
