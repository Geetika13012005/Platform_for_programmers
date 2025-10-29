import {
  readUsers,
  writeUsers,
  hashPassword,
  verifyPassword,
  newId,
  defaultProfile,
} from "../utils/store.js";
import jwt from "jsonwebtoken";

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profile: user.profile,
  };
}

export const signup = (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Missing name, email or password" });
  }

  const users = readUsers();
  const normalizedEmail = String(email).toLowerCase();
  const existing = users.find((user) => user.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const user = {
    id: newId("usr"),
    email: normalizedEmail,
    name: String(name),
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
    profile: defaultProfile(),
  };

  users.push(user);
  writeUsers(users);

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.SECRET_KEY, { expiresIn: "1h" });

  return res.status(201).json({ user: serializeUser(user), token });
};

export const login = (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  const users = readUsers();
  const normalizedEmail = String(email).toLowerCase();
  const user = users.find((item) => item.email.toLowerCase() === normalizedEmail);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.SECRET_KEY, { expiresIn: "1h" });

  return res.json({ user: serializeUser(user), token });
};

export const me = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const users = readUsers();
    const user = users.find((u) => u.id === decoded.id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    return res.json(serializeUser(user));
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
