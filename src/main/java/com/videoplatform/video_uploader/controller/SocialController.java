package com.videoplatform.video_uploader.controller;

import com.videoplatform.video_uploader.model.Notification;
import com.videoplatform.video_uploader.model.Report;
import com.videoplatform.video_uploader.model.Subscription;
import com.videoplatform.video_uploader.model.User;
import com.videoplatform.video_uploader.repository.NotificationRepository;
import com.videoplatform.video_uploader.repository.ReportRepository;
import com.videoplatform.video_uploader.repository.SubscriptionRepository;
import com.videoplatform.video_uploader.repository.UserRepository;
import com.videoplatform.video_uploader.service.AuthService;
import com.videoplatform.video_uploader.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Rest of your SocialController class remains the same

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class SocialController {

    private final SubscriptionRepository subscriptionRepository;
    private final NotificationRepository notificationRepository;
    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final NotificationService notificationService;

    // ============ SUBSCRIBE ============

    @PostMapping("/channels/{channelId}/subscribe")
    @Transactional
    public ResponseEntity<?> subscribe(@PathVariable UUID channelId, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));

            if (userId.equals(channelId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Cannot subscribe to yourself"));
            }

            if (subscriptionRepository.existsBySubscriberIdAndChannelId(userId, channelId)) {
                subscriptionRepository.deleteBySubscriberIdAndChannelId(userId, channelId);
                log.info("User {} unsubscribed from channel {}", userId, channelId);
                return ResponseEntity.ok(Map.of("subscribed", false));
            } else {
                Subscription sub = new Subscription();
                sub.setSubscriberId(userId);
                sub.setChannelId(channelId);
                subscriptionRepository.save(sub);

                // Create notification for channel owner
                User subscriber = userRepository.findById(userId).orElse(null);
                String subName = subscriber != null ? subscriber.getUsername() : "Someone";
                notificationService.createNotification(channelId, userId, "SUBSCRIBE", null,
                        subName + " subscribed to you");

                log.info("User {} subscribed to channel {}", userId, channelId);
                return ResponseEntity.ok(Map.of("subscribed", true));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/channels/subscriptions")
    public ResponseEntity<?> getMySubscriptions(@RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            List<UUID> channelIds = subscriptionRepository.findSubscribedChannelIds(userId);
            List<Map<String, Object>> channels = channelIds.stream().map(cid -> {
                User u = userRepository.findById(cid).orElse(null);
                if (u == null) return null;
                return Map.<String, Object>of(
                    "id", u.getId(),
                    "username", u.getUsername(),
                    "avatarColor", u.getAvatarColor() != null ? u.getAvatarColor() : "#667eea",
                    "avatarPath", u.getAvatarPath() != null ? u.getAvatarPath() : ""
                );
            }).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toList());
            return ResponseEntity.ok(channels);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/channels/{channelId}/subscribers")
    public ResponseEntity<?> getSubscriberCount(@PathVariable UUID channelId) {
        long count = subscriptionRepository.countByChannelId(channelId);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @GetMapping("/channels/{channelId}/is-subscribed")
    public ResponseEntity<?> isSubscribed(@PathVariable UUID channelId, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            boolean subscribed = subscriptionRepository.existsBySubscriberIdAndChannelId(userId, channelId);
            return ResponseEntity.ok(Map.of("subscribed", subscribed));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("subscribed", false));
        }
    }

    // ============ NOTIFICATIONS ============

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(@RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
            return ResponseEntity.ok(notifications);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/notifications/unread-count")
    public ResponseEntity<?> getUnreadCount(@RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            long count = notificationRepository.countByUserIdAndIsReadFalse(userId);
            return ResponseEntity.ok(Map.of("count", count));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("count", 0));
        }
    }

    @PostMapping("/notifications/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable UUID id, @RequestHeader("Authorization") String token) {
        try {
            authService.validateToken(token.replace("Bearer ", ""));
            Notification notif = notificationRepository.findById(id).orElseThrow();
            notif.setRead(true);
            notificationRepository.save(notif);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/notifications/read-all")
    public ResponseEntity<?> markAllAsRead(@RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalse(userId);
            unread.forEach(n -> n.setRead(true));
            notificationRepository.saveAll(unread);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ============ REPORTS ============

    @PostMapping("/videos/{videoId}/report")
    public ResponseEntity<?> reportVideo(@PathVariable UUID videoId, @RequestBody Map<String, String> request, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));

            if (reportRepository.existsByVideoIdAndReporterId(videoId, userId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Already reported this video"));
            }

            Report report = new Report();
            report.setVideoId(videoId);
            report.setReporterId(userId);
            report.setReason(request.getOrDefault("reason", "OTHER"));
            report.setDescription(request.get("description"));
            reportRepository.save(report);

            log.info("Video {} reported by user {}: {}", videoId, userId, report.getReason());
            return ResponseEntity.ok(Map.of("message", "Report submitted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

}