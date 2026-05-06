package com.videoplatform.video_uploader.controller;

import com.videoplatform.video_uploader.model.User;
import com.videoplatform.video_uploader.repository.UserRepository;
import com.videoplatform.video_uploader.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

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
            // Get user to return userId
            var userOpt = userRepository.findByUsername(request.get("username"));
            String userId = userOpt.map(u -> u.getId().toString()).orElse("");
            return ResponseEntity.ok(Map.of("token", token, "userId", userId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}