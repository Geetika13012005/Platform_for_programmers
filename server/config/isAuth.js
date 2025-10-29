const jwt = require("jsonwebtoken");

exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (!authHeader || typeof authHeader !== "string") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = parts[1];
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    if (!decoded) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = decoded;
    return next();
  } catch (error) {
    console.log("verifyToken error:", error && error.message ? error.message : error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
