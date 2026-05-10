package com.videoplatform.video_uploader.controller;

import com.videoplatform.video_uploader.model.User;
import com.videoplatform.video_uploader.repository.UserRepository;
import com.videoplatform.video_uploader.model.Video;
import com.videoplatform.video_uploader.repository.VideoRepository;
import com.videoplatform.video_uploader.service.AuthService;
import com.videoplatform.video_uploader.service.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final VideoRepository videoRepository;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request) {
        try {
            User user = authService.register(
                    request.get("username"),
                    request.get("email"),
                    request.get("password")
            );
            return ResponseEntity.ok(Map.of(
                    "message", "User registered successfully",
                    "userId", user.getId().toString()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        try {
            String token = authService.login(
                    request.get("username"),
                    request.get("password")
            );
            var userOpt = userRepository.findByUsername(request.get("username"));
            String userId = userOpt.map(u -> u.getId().toString()).orElse("");
            return ResponseEntity.ok(Map.of("token", token, "userId", userId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/users/search")
    public ResponseEntity<?> searchUsers(@RequestParam("q") String query) {
        try {
            if (query == null || query.trim().isEmpty()) {
                return ResponseEntity.ok(List.of());
            }
            List<User> users = userRepository.findByUsernameContainingIgnoreCase(query.trim());
            List<Map<String, String>> result = users.stream()
                    .map(u -> Map.of(
                            "id", u.getId().toString(),
                            "username", u.getUsername(),
                            "avatarColor", u.getAvatarColor() != null ? u.getAvatarColor() : "#667eea"
                    ))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    private Map<String, Object> userToMap(User u) {
        return Map.of(
                "id", u.getId().toString(),
                "username", u.getUsername(),
                "avatarColor", u.getAvatarColor() != null ? u.getAvatarColor() : "#667eea",
                "avatarPath", u.getAvatarPath() != null ? u.getAvatarPath() : ""
        );
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@PathVariable String id) {
        try {
            User user = userRepository.findById(java.util.UUID.fromString(id)).orElseThrow();
            return ResponseEntity.ok(userToMap(user));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/users/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> request, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            User user = userRepository.findById(userId).orElseThrow();
            if (request.containsKey("avatarColor")) {
                user.setAvatarColor(request.get("avatarColor"));
                if (user.getAvatarPath() != null) {
                    try { Files.deleteIfExists(Paths.get(user.getAvatarPath())); } catch (Exception ignored) {}
                    user.setAvatarPath(null);
                }
            }
            userRepository.save(user);
            return ResponseEntity.ok(userToMap(user));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/users/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") MultipartFile file, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            String avatarPath = storageService.uploadAvatar(file, userId);
            User user = userRepository.findById(userId).orElseThrow();
            user.setAvatarPath(avatarPath);
            user.setAvatarColor(null);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("avatarPath", avatarPath, "message", "Avatar uploaded"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/users/{id}/avatar")
    public ResponseEntity<Resource> getAvatar(@PathVariable String id) {
        try {
            User user = userRepository.findById(java.util.UUID.fromString(id)).orElseThrow();
            String avatarPath = user.getAvatarPath();
            if (avatarPath == null || avatarPath.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Path filePath = Paths.get(avatarPath);
            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }
            Resource resource = new UrlResource(filePath.toUri());
            String contentType = Files.probeContentType(filePath);
            if (contentType == null) contentType = "image/jpeg";
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/users/password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> request, @RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            authService.changePassword(userId, request.get("oldPassword"), request.get("newPassword"));
            return ResponseEntity.ok(Map.of("message", "Password changed"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/users/account")
    public ResponseEntity<?> deleteAccount(@RequestHeader("Authorization") String token) {
        try {
            UUID userId = authService.validateToken(token.replace("Bearer ", ""));
            // Delete user's videos first
            List<Video> userVideos = videoRepository.findByUserId(userId);
            for (Video v : userVideos) {
                if (v.getStoragePath() != null) {
                    try { Files.deleteIfExists(Paths.get(v.getStoragePath())); } catch (Exception ignored) {}
                }
                if (v.getThumbnailPath() != null) {
                    try { Files.deleteIfExists(Paths.get(v.getThumbnailPath())); } catch (Exception ignored) {}
                }
                videoRepository.delete(v);
            }
            // Delete avatar file
            User user = userRepository.findById(userId).orElse(null);
            if (user != null && user.getAvatarPath() != null) {
                try { Files.deleteIfExists(Paths.get(user.getAvatarPath())); } catch (Exception ignored) {}
            }
            authService.deleteAccount(userId);
            return ResponseEntity.ok(Map.of("message", "Account deleted"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
