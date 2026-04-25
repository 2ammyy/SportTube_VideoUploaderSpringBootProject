package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.Like;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LikeRepository extends JpaRepository<Like, UUID> {
    Optional<Like> findByVideoIdAndUserId(UUID videoId, UUID userId);
    long countByVideoIdAndIsLikeTrue(UUID videoId);
    long countByVideoIdAndIsLikeFalse(UUID videoId);
}