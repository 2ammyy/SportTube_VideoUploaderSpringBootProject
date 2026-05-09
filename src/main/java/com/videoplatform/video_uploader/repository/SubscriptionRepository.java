package com.videoplatform.video_uploader.repository;

import com.videoplatform.video_uploader.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {
    boolean existsBySubscriberIdAndChannelId(UUID subscriberId, UUID channelId);
    void deleteBySubscriberIdAndChannelId(UUID subscriberId, UUID channelId);
    List<Subscription> findByChannelId(UUID channelId);
    List<Subscription> findBySubscriberId(UUID subscriberId);
    
    @Query("SELECT s.channelId FROM Subscription s WHERE s.subscriberId = :subscriberId")
    List<UUID> findSubscribedChannelIds(@Param("subscriberId") UUID subscriberId);
    
    @Query("SELECT COUNT(s) FROM Subscription s WHERE s.channelId = :channelId")
    long countByChannelId(@Param("channelId") UUID channelId);
}
