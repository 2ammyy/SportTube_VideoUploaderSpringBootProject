package com.videoplatform.video_uploader.repository;
import com.videoplatform.video_uploader.model.Video;
import com.videoplatform.video_uploader.model.VideoStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface VideoRepository extends JpaRepository<Video, UUID> {
    List<Video> findByStatus(VideoStatus status);
    List<Video> findByUserId(UUID userId);
    long countByStatus(VideoStatus status);
    List<Video> findAllByOrderByCreatedAtDesc();
    long count();
    List<Video> findByCategoryInAndIdNotInAndStatus(List<String> categories, List<UUID> excludeIds, VideoStatus status);
    List<Video> findByCategoryInAndIdNotIn(List<String> categories, List<UUID> excludeIds);
    List<Video> findByCategoryIsNotNullAndIdNotIn(List<UUID> excludeIds);
    @Query("SELECT DISTINCT v.category FROM Video v WHERE v.category IS NOT NULL AND v.category <> ''")
    List<String> findDistinctCategories();
}