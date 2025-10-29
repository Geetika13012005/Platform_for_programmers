const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectDb } = require("./config/database");
const { signUp, login } = require("./controller/userController");
const { verifyToken } = require("./config/isAuth");
const User = require("./models/userModels");
const notebookRoutes = require("./routes/notebookRoutes");
const { execute } = require("./routes/execute");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

connectDb();

// Allow all origins (useful for development, be cautious in production)
app.use(cors({
  origin:true, // Allow all origins
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());

// Auth endpoints (match client expectations)
app.post("/api/auth/signup", signUp);
app.post("/api/auth/login", login);

// Protected 'me' endpoint using JWT verifyToken middleware
app.get("/api/auth/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await User.findById(userId).select("_id email name");
    if (!user) return res.status(404).json({ message: "User not found" });
    // Return user data in a format that matches what the client expects
    return res.json({ 
      id: user._id, 
      email: user.email, 
      name: user.name 
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error fetching user" });
  }
});

// Notebook routes
app.use("/api/notebooks", notebookRoutes);

// Code execution endpoint
app.post("/api/run", verifyToken, execute);

app.get("/", (req, res) => {
  res.send("Welcome to the Platform for Programmers API");
});

app.listen(PORT, () => {
  console.log(`\u2705 Server is running on port ${PORT}`);
});