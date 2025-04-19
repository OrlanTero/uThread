const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { generateOTP, sendVerificationEmail, sendWelcomeEmail } = require("../services/emailService");

// @route   POST /api/auth/signup
// @desc    Register a user with email verification
// @access  Public
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({ message: "User already exists" });
    }

    // If user exists but not verified, delete the unverified account
    if (existingUser && !existingUser.isEmailVerified) {
      await User.findByIdAndDelete(existingUser._id);
    }

    // Check if username is taken
    existingUser = await User.findOne({ username });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date();
    otpExpires.setMinutes(otpExpires.getMinutes() + 15); // OTP expires in 15 minutes

    // Create new user with OTP
    const user = new User({
      username,
      email,
      password,
      isEmailVerified: false,
      isVerified: false, // Default value for verified badge
      emailVerificationOTP: otp,
      emailVerificationOTPExpires: otpExpires,
      emailVerificationOTPAttempts: 0
    });

    await user.save();

    // Try to send verification email but don't fail if it doesn't work
    let emailSent = true;
    try {
      await sendVerificationEmail(email, otp, username);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      emailSent = false;
    }
    
    // Return success message with appropriate info
    res.status(201).json({ 
      message: emailSent 
        ? "Please check your email for a verification code to complete your registration."
        : "Account created but we couldn't send the verification email. Use the resend verification option if needed.",
      userId: user._id,
      verificationSent: emailSent
    });
    
  } catch (err) {
    console.error("Registration error:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(500).json({ message: "Server error during registration" });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and complete user registration
// @access  Public
router.post("/verify-otp", async (req, res) => {
  const { userId, otp } = req.body;

  try {
    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Check if OTP has expired
    if (new Date() > user.emailVerificationOTPExpires) {
      return res.status(400).json({ message: "Verification code has expired" });
    }

    // Increment attempt counter
    user.emailVerificationOTPAttempts += 1;

    // Check if max attempts reached (5 attempts)
    if (user.emailVerificationOTPAttempts >= 5) {
      await user.save();
      return res.status(400).json({ message: "Maximum verification attempts exceeded. Please request a new code." });
    }

    // Check if OTP matches
    if (user.emailVerificationOTP !== otp) {
      await user.save();
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // OTP is valid, mark user as verified
    user.isEmailVerified = true;
    user.emailVerificationOTP = null;
    user.emailVerificationOTPExpires = null;
    user.emailVerificationOTPAttempts = 0;
    await user.save();

    // Send welcome email
    await sendWelcomeEmail(user.email, user.username);

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
      (err, token) => {
        if (err) throw err;
        res.json({ token, message: "Email verified successfully" });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP verification code
// @access  Public
router.post("/resend-otp", async (req, res) => {
  const { userId } = req.body;

  try {
    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date();
    otpExpires.setMinutes(otpExpires.getMinutes() + 15); // OTP expires in 15 minutes

    // Update user with new OTP
    user.emailVerificationOTP = otp;
    user.emailVerificationOTPExpires = otpExpires;
    user.emailVerificationOTPAttempts = 0;
    await user.save();

    // Send verification email
    await sendVerificationEmail(user.email, otp, user.username);

    // Return success
    res.json({ message: "Verification code has been resent to your email" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if input is email or username
    let user;
    const isEmail = email.includes('@');
    
    if (isEmail) {
      // Find user by email
      user = await User.findOne({ email });
    } else {
      // Find user by username
      user = await User.findOne({ username: email });
    }
    
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      // Generate new OTP for unverified user
      const otp = generateOTP();
      const otpExpires = new Date();
      otpExpires.setMinutes(otpExpires.getMinutes() + 15);

      user.emailVerificationOTP = otp;
      user.emailVerificationOTPExpires = otpExpires;
      user.emailVerificationOTPAttempts = 0;
      await user.save();

      // Send verification email
      await sendVerificationEmail(user.email, otp, user.username);

      return res.status(403).json({ 
        message: "Email not verified. A new verification code has been sent to your email.",
        userId: user._id,
        requiresVerification: true
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/auth/user
// @desc    Get authenticated user
// @access  Private
router.get("/user", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -emailVerificationOTP -emailVerificationOTPExpires -emailVerificationOTPAttempts");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
