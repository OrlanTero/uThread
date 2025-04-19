const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
  },
  displayName: {
    type: String,
    trim: true,
    default: function() {
      return this.username;
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  bio: {
    type: String,
    default: "",
    maxlength: 160,
  },
  location: {
    type: String,
    default: "",
    maxlength: 100,
  },
  country: {
    type: String,
    default: "",
    maxlength: 100,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Non-binary", "Prefer not to say", "Other"],
    default: "Prefer not to say"
  },
  website: {
    type: String,
    default: "",
    maxlength: 100,
  },
  birthday: {
    type: Date,
    default: null,
  },
  avatar: {
    type: String,
    default: "",
  },
  coverPhoto: {
    type: String,
    default: "",
  },
  coverColor: {
    type: String,
    default: "",
  },
  occupation: {
    type: String,
    default: "",
    maxlength: 100,
  },
  education: {
    type: String,
    default: "",
    maxlength: 100,
  },
  interests: [
    {
      type: String,
      trim: true
    }
  ],
  following: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    }
  ],
  followers: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    }
  ],
  blockedUsers: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  bookmarks: [
    {
      post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if password is correct
UserSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", UserSchema);
