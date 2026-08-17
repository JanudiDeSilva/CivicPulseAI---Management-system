import express from "express";
import { AuthService } from "../services/authService.js";

const router = express.Router();

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, nic, password, confirmPassword } = req.body;

    console.log("Registration attempt:", { firstName, lastName, email, nic });

    // Validation
    if (!firstName || !lastName || !email || !phone || !nic || !password || !confirmPassword) {
      return res.status(400).json({ 
        error: "Please complete all registration fields." 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        error: "Password confirmation does not match." 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: "Password must be at least 6 characters long." 
      });
    }

    const user = await AuthService.registerUser({
      firstName,
      lastName,
      email,
      phone,
      nic,
      password,
    });

    console.log("Registration successful:", user.email);

    res.status(201).json({
      success: true,
      user,
      message: "Registration successful",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(400).json({ 
      error: error.message || "Registration failed" 
    });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, nic, password, role } = req.body;

    console.log("Login attempt:", { email, nic, role });

    if (!password) {
      return res.status(400).json({ 
        error: "Password is required" 
      });
    }

    if (role === "admin" && !email) {
      return res.status(400).json({ 
        error: "Email is required for admin login" 
      });
    }

    if (role === "user" && !email && !nic) {
      return res.status(400).json({ 
        error: "Email or NIC is required for user login" 
      });
    }

    const user = await AuthService.loginUser(email, nic, password, role);

    console.log("Login successful:", user.email);

    res.json({
      success: true,
      user,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ 
      error: error.message || "Login failed" 
    });
  }
});

// Request OTP
router.post("/otp/request", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: "Email is required" 
      });
    }

    const otpData = await AuthService.requestOtp(email);

    res.json({
      success: true,
      ...otpData,
    });
  } catch (error) {
    console.error("OTP request error:", error);
    res.status(400).json({ 
      error: error.message || "OTP request failed" 
    });
  }
});

// Get user by ID
router.get("/user/:id", async (req, res) => {
  try {
    const user = await AuthService.getUserById(req.params.id);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(404).json({ 
      error: error.message || "User not found" 
    });
  }
});

// Seed admin user (for development)
router.post("/seed-admin", async (req, res) => {
  try {
    const admin = await AuthService.seedAdminUser();
    res.json({
      success: true,
      user: admin,
      message: "Admin user seeded successfully",
    });
  } catch (error) {
    console.error("Seed admin error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to seed admin user" 
    });
  }
});

export default router;