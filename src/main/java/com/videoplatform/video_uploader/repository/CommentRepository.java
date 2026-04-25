package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface CommentRepository extends JpaRepository<Comment, UUID> {
    List<Comment> findByVideoIdOrderByCreatedAtDesc(UUID videoId);
    long countByVideoId(UUID videoId);
}