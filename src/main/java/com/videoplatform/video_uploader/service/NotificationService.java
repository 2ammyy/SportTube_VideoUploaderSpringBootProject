package com.videoplatform.video_uploader.service;

import com.videoplatform.video_uploader.model.Notification;
import com.videoplatform.video_uploader.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notificationRepository;

    public void createNotification(UUID userId, UUID triggeredBy, String type, UUID videoId, String message) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setTriggeredBy(triggeredBy);
        notification.setType(type);
        notification.setVideoId(videoId);
        notification.setMessage(message);
        notificationRepository.save(notification);
    }

    public List<Notification> getNotifications(UUID userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public void markAllAsRead(UUID userId) {
        List<Notification> notifications = notificationRepository.findByUserIdAndIsReadFalse(userId);
        notifications.forEach(notification -> notification.setRead(true));
        notificationRepository.saveAll(notifications);
    }
}
