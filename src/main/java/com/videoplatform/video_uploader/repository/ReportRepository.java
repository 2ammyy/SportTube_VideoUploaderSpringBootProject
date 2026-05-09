package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ReportRepository extends JpaRepository<Report, UUID> {
    List<Report> findByVideoId(UUID videoId);
    List<Report> findByIsResolvedFalse();
    boolean existsByVideoIdAndReporterId(UUID videoId, UUID reporterId);
}
