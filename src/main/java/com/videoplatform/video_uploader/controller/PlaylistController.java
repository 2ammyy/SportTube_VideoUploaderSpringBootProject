package com.videoplatform.video_uploader.controller;

import com.videoplatform.video_uploader.model.*;
import com.videoplatform.video_uploader.repository.*;
import com.videoplatform.video_uploader.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/playlists")
@RequiredArgsConstructor
@Slf4j
public class PlaylistController {

    private final PlaylistRepository playlistRepository;
    private final PlaylistItemRepository playlistItemRepository;
    private final SavedPlaylistRepository savedPlaylistRepository;
    private final PlaylistHistoryRepository playlistHistoryRepository;
    private final VideoRepository videoRepository;
    private final UserRepository userRepository;
    private final AuthService authService;

    // ==================== CRUD ====================

    @PostMapping
    public ResponseEntity<?> createPlaylist(@RequestBody Map<String, String> body,
                                            @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            String name = body.get("name");
            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Playlist name is required"));
            }
            Playlist playlist = new Playlist();
            playlist.setName(name.trim());
            playlist.setDescription(body.getOrDefault("description", ""));
            playlist.setUserId(userId);
            playlist = playlistRepository.save(playlist);
            return ResponseEntity.ok(playlistToMap(playlist));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updatePlaylist(@PathVariable UUID id,
                                            @RequestBody Map<String, String> body,
                                            @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            Playlist playlist = playlistRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Playlist not found"));
            if (!playlist.getUserId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized"));
            }
            if (body.containsKey("name")) {
                String name = body.get("name");
                if (name.trim().isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Playlist name cannot be empty"));
                }
                playlist.setName(name.trim());
            }
            if (body.containsKey("description")) {
                playlist.setDescription(body.get("description"));
            }
            playlist.setUpdatedAt(LocalDateTime.now());
            playlist = playlistRepository.save(playlist);
            return ResponseEntity.ok(playlistToMap(playlist));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePlaylist(@PathVariable UUID id,
                                            @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            Playlist playlist = playlistRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Playlist not found"));
            if (!playlist.getUserId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized"));
            }
            // Cascade delete items, saved refs, and history
            playlistItemRepository.deleteAll(playlistItemRepository.findByPlaylistIdOrderByPositionAsc(id));
            savedPlaylistRepository.findAll().stream()
                .filter(sp -> sp.getPlaylistId().equals(id))
                .forEach(savedPlaylistRepository::delete);
            playlistHistoryRepository.findAll().stream()
                .filter(ph -> ph.getPlaylistId().equals(id))
                .forEach(playlistHistoryRepository::delete);
            playlistRepository.delete(playlist);
            return ResponseEntity.ok(Map.of("message", "Playlist deleted"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== VIDEOS IN PLAYLIST ====================

    @PostMapping("/{id}/videos")
    public ResponseEntity<?> addVideoToPlaylist(@PathVariable UUID id,
                                                 @RequestBody Map<String, String> body,
                                                 @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            Playlist playlist = playlistRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Playlist not found"));
            if (!playlist.getUserId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized"));
            }
            UUID videoId = UUID.fromString(body.get("videoId"));
            // Check if already in playlist
            if (playlistItemRepository.findByPlaylistIdAndVideoId(id, videoId).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Video already in playlist"));
            }
            PlaylistItem item = new PlaylistItem();
            item.setPlaylistId(id);
            item.setVideoId(videoId);
            item.setPosition(playlistItemRepository.countByPlaylistId(id));
            playlistItemRepository.save(item);
            playlist.setUpdatedAt(LocalDateTime.now());
            playlistRepository.save(playlist);
            return ResponseEntity.ok(Map.of("message", "Video added to playlist"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}/videos/{videoId}")
    public ResponseEntity<?> removeVideoFromPlaylist(@PathVariable UUID id,
                                                      @PathVariable UUID videoId,
                                                      @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            Playlist playlist = playlistRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Playlist not found"));
            if (!playlist.getUserId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized"));
            }
            PlaylistItem item = playlistItemRepository.findByPlaylistIdAndVideoId(id, videoId)
                    .orElseThrow(() -> new RuntimeException("Video not in playlist"));
            playlistItemRepository.delete(item);
            // Reorder remaining items
            List<PlaylistItem> remaining = playlistItemRepository.findByPlaylistIdOrderByPositionAsc(id);
            for (int i = 0; i < remaining.size(); i++) {
                remaining.get(i).setPosition(i);
            }
            playlistItemRepository.saveAll(remaining);
            playlist.setUpdatedAt(LocalDateTime.now());
            playlistRepository.save(playlist);
            return ResponseEntity.ok(Map.of("message", "Video removed from playlist"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/videos/reorder")
    public ResponseEntity<?> reorderPlaylistVideos(@PathVariable UUID id,
                                                    @RequestBody Map<String, List<String>> body,
                                                    @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            Playlist playlist = playlistRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Playlist not found"));
            if (!playlist.getUserId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Not authorized"));
            }
            List<String> videoIdStrings = body.get("videoIds");
            if (videoIdStrings == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "videoIds required"));
            }
            for (int i = 0; i < videoIdStrings.size(); i++) {
                UUID vid = UUID.fromString(videoIdStrings.get(i));
                PlaylistItem item = playlistItemRepository.findByPlaylistIdAndVideoId(id, vid)
                        .orElseThrow(() -> new RuntimeException("Video not in playlist: " + vid));
                item.setPosition(i);
                playlistItemRepository.save(item);
            }
            playlist.setUpdatedAt(LocalDateTime.now());
            playlistRepository.save(playlist);
            return ResponseEntity.ok(Map.of("message", "Reordered"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== GET PLAYLISTS ====================

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserPlaylists(@PathVariable UUID userId) {
        try {
            List<Playlist> playlists = playlistRepository.findByUserIdOrderByUpdatedAtDesc(userId);
            List<Map<String, Object>> result = playlists.stream().map(this::playlistToRichMap).collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPlaylist(@PathVariable UUID id) {
        try {
            Playlist playlist = playlistRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Playlist not found"));
            return ResponseEntity.ok(playlistToFullMap(playlist));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ==================== SAVE / UNSAVE PLAYLISTS ====================

    @PostMapping("/saved/{playlistId}")
    public ResponseEntity<?> savePlaylist(@PathVariable UUID playlistId,
                                           @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            if (savedPlaylistRepository.existsByUserIdAndPlaylistId(userId, playlistId)) {
                return ResponseEntity.ok(Map.of("message", "Already saved"));
            }
            SavedPlaylist sp = new SavedPlaylist();
            sp.setUserId(userId);
            sp.setPlaylistId(playlistId);
            savedPlaylistRepository.save(sp);
            return ResponseEntity.ok(Map.of("message", "Playlist saved"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/saved/{playlistId}")
    public ResponseEntity<?> unsavePlaylist(@PathVariable UUID playlistId,
                                             @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            SavedPlaylist sp = savedPlaylistRepository.findByUserIdAndPlaylistId(userId, playlistId)
                    .orElseThrow(() -> new RuntimeException("Not saved"));
            savedPlaylistRepository.delete(sp);
            return ResponseEntity.ok(Map.of("message", "Playlist unsaved"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/saved")
    public ResponseEntity<?> getSavedPlaylists(@RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            List<SavedPlaylist> saved = savedPlaylistRepository.findByUserIdOrderBySavedAtDesc(userId);
            List<Map<String, Object>> result = saved.stream().map(sp -> {
                Playlist p = playlistRepository.findById(sp.getPlaylistId()).orElse(null);
                if (p == null) return null;
                Map<String, Object> m = playlistToRichMap(p);
                m.put("savedAt", sp.getSavedAt());
                return m;
            }).filter(Objects::nonNull).collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== HISTORY ====================

    @PostMapping("/history/{playlistId}")
    public ResponseEntity<?> recordPlaylistView(@PathVariable UUID playlistId,
                                                 @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            if (!playlistRepository.existsById(playlistId)) {
                return ResponseEntity.notFound().build();
            }
            PlaylistHistory ph = new PlaylistHistory();
            ph.setUserId(userId);
            ph.setPlaylistId(playlistId);
            playlistHistoryRepository.save(ph);
            return ResponseEntity.ok(Map.of("message", "Recorded"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getPlaylistHistory(@RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            List<PlaylistHistory> history = playlistHistoryRepository.findByUserIdOrderByViewedAtDesc(userId);
            // Deduplicate by playlistId, keep latest
            Map<UUID, PlaylistHistory> latest = new LinkedHashMap<>();
            for (PlaylistHistory ph : history) {
                latest.putIfAbsent(ph.getPlaylistId(), ph);
            }
            List<Map<String, Object>> result = latest.values().stream().map(ph -> {
                Playlist p = playlistRepository.findById(ph.getPlaylistId()).orElse(null);
                if (p == null) return null;
                Map<String, Object> m = playlistToRichMap(p);
                m.put("viewedAt", ph.getViewedAt());
                return m;
            }).filter(Objects::nonNull).collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== HELPERS ====================

    private Map<String, Object> playlistToMap(Playlist p) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("name", p.getName());
        m.put("description", p.getDescription());
        m.put("userId", p.getUserId());
        m.put("createdAt", p.getCreatedAt());
        m.put("updatedAt", p.getUpdatedAt());
        return m;
    }

    private Map<String, Object> playlistToRichMap(Playlist p) {
        Map<String, Object> m = playlistToMap(p);
        long videoCount = playlistItemRepository.countByPlaylistId(p.getId());
        m.put("videoCount", videoCount);
        // Get thumbnail video IDs sorted by recently added (most recent first)
        List<PlaylistItem> items = playlistItemRepository.findByPlaylistIdOrderByPositionAsc(p.getId());
        List<String> thumbnails = items.stream()
                .sorted((a, b) -> b.getAddedAt() != null ? b.getAddedAt().compareTo(a.getAddedAt()) : 0)
                .limit(4)
                .map(item -> item.getVideoId().toString())
                .collect(Collectors.toList());
        m.put("thumbnails", thumbnails);
        // Username
        userRepository.findById(p.getUserId()).ifPresent(u -> {
            m.put("username", u.getUsername());
            m.put("avatarColor", u.getAvatarColor());
            m.put("avatarPath", u.getAvatarPath() != null ? u.getAvatarPath() : "");
        });
        return m;
    }

    private Map<String, Object> playlistToFullMap(Playlist p) {
        Map<String, Object> m = playlistToRichMap(p);
        List<PlaylistItem> items = playlistItemRepository.findByPlaylistIdOrderByPositionAsc(p.getId());
        List<Map<String, Object>> videos = items.stream()
                .map(item -> {
                    Video v = videoRepository.findById(item.getVideoId()).orElse(null);
                    if (v == null) return null;
                    Map<String, Object> vm = enrichVideo(v);
                    vm.put("position", item.getPosition());
                    vm.put("addedAt", item.getAddedAt());
                    return vm;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        m.put("videos", videos);
        return m;
    }

    private Map<String, Object> enrichVideo(Video v) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", v.getId());
        map.put("title", v.getTitle());
        map.put("originalFilename", v.getOriginalFilename());
        map.put("description", v.getDescription());
        map.put("userId", v.getUserId());
        map.put("storagePath", v.getStoragePath());
        map.put("thumbnailPath", v.getThumbnailPath());
        map.put("status", v.getStatus() != null ? v.getStatus().name() : null);
        map.put("createdAt", v.getCreatedAt());
        map.put("aiLabel", v.getAiLabel());
        map.put("privacy", v.getPrivacy());
        User uploader = userRepository.findById(v.getUserId()).orElse(null);
        map.put("username", uploader != null ? uploader.getUsername() : "Unknown");
        map.put("avatarColor", uploader != null ? uploader.getAvatarColor() : "#667eea");
        map.put("avatarPath", uploader != null && uploader.getAvatarPath() != null ? uploader.getAvatarPath() : "");
        return map;
    }
}
