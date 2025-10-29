const mongoose = require('mongoose');

exports.connectDb = async () => {
  try {
    console.log("🔍 Connecting to MongoDB using URI:", process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connection established...");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};
