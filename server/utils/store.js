import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "server", "data");
const USERS_FILE = join(DATA_DIR, "users.json");
const SESSIONS_FILE = join(DATA_DIR, "sessions.json");

/**
 * @typedef {"python" | "cpp" | "javascript"} Lang
 *
 * @typedef {Object} NotebookCell
 * @property {string} id
 * @property {Lang} language
 * @property {string} code
 * @property {string} [stdout]
 * @property {string} [stderr]
 *
 * @typedef {Object} Notebook
 * @property {string} id
 * @property {string} title
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {NotebookCell[]} cells
 *
 * @typedef {Object} UserProfile
 * @property {Notebook[]} notebooks
 *
 * @typedef {Object} UserRecord
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {string} passwordHash
 * @property {number} createdAt
 * @property {UserProfile} [profile]
 *
 * @typedef {Object} SessionRecord
 * @property {string} sid
 * @property {string} userId
 * @property {number} createdAt
 * @property {number} lastSeenAt
 */

function ensureStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(USERS_FILE)) writeFileSync(USERS_FILE, JSON.stringify([]));
  if (!existsSync(SESSIONS_FILE)) writeFileSync(SESSIONS_FILE, JSON.stringify([]));
}

/**
 * @returns {UserRecord[]}
 */
export function readUsers() {
  ensureStore();
  const buf = readFileSync(USERS_FILE, "utf8");
  try {
    const parsed = JSON.parse(buf);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {UserRecord[]} users
 */
export function writeUsers(users) {
  ensureStore();
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

/**
 * @returns {SessionRecord[]}
 */
export function readSessions() {
  ensureStore();
  const buf = readFileSync(SESSIONS_FILE, "utf8");
  try {
    const parsed = JSON.parse(buf);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {SessionRecord[]} sessions
 */
export function writeSessions(sessions) {
  ensureStore();
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

/**
 * @param {string} password
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/**
 * @param {string} password
 * @param {string} passwordHash
 */
export function verifyPassword(password, passwordHash) {
  const [algo, salt, stored] = passwordHash.split("$");
  if (algo !== "scrypt" || !salt || !stored) return false;
  const hash = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(stored, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * @param {string} [prefix]
 */
export function newId(prefix = "id") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

/**
 * @returns {UserProfile}
 */
export function defaultProfile() {
  const now = Date.now();
  return {
    notebooks: [
      {
        id: newId("nbk"),
        title: "Untitled Notebook",
        createdAt: now,
        updatedAt: now,
        cells: [
          { id: newId("cell"), language: "python", code: "print('Hello from Python!')" },
        ],
      },
    ],
  };
}

/**
 * @param {UserRecord} user
 */
export function normalizeProfile(user) {
  let updated = false;
  if (!user.profile) {
    user.profile = defaultProfile();
    return true;
  }
  if (!Array.isArray(user.profile.notebooks)) {
    user.profile.notebooks = defaultProfile().notebooks;
    return true;
  }
  for (const notebook of user.profile.notebooks) {
    if (!notebook || !Array.isArray(notebook.cells)) {
      notebook.cells = [
        { id: newId("cell"), language: "python", code: "print('Hello from Python!')" },
      ];
      updated = true;
    }
  }
  return updated;
}
