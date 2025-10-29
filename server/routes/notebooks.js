import {
  readSessions,
  readUsers,
  writeUsers,
  newId,
  defaultProfile,
  normalizeProfile,
} from "../utils/store.js";

const SESSION_COOKIE = "sid";

function requireUser(req) {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) {
    return { error: { status: 401, message: "Not authenticated" } };
  }

  const sessions = readSessions();
  const session = sessions.find((item) => item.sid === sid);
  if (!session) {
    return { error: { status: 401, message: "Invalid session" } };
  }

  const users = readUsers();
  const user = users.find((item) => item.id === session.userId);
  if (!user) {
    return { error: { status: 401, message: "Invalid session" } };
  }

  let profile = user.profile;
  if (!profile) {
    profile = defaultProfile();
    user.profile = profile;
    writeUsers(users);
  } else if (normalizeProfile(user)) {
    writeUsers(users);
  }

  return { user, users };
}

export const listNotebooks = (req, res) => {
  const result = requireUser(req);
  if (result.error) {
    return res.status(result.error.status).json({ error: result.error.message });
  }

  const notebooks = result.user.profile?.notebooks ?? [];
  return res.json(notebooks);
};

export const createNotebook = (req, res) => {
  const result = requireUser(req);
  if (result.error) {
    return res.status(result.error.status).json({ error: result.error.message });
  }

  const users = result.users;
  const user = result.user;
  const now = Date.now();
  const cells = Array.isArray(req.body?.cells)
    ? req.body.cells
    : [{ id: newId("cell"), language: "python", code: "print('Hello from Python!')" }];

  const notebook = {
    id: newId("nbk"),
    title: String(req.body?.title ?? "Untitled Notebook"),
    createdAt: now,
    updatedAt: now,
    cells,
  };

  if (!user.profile) {
    user.profile = defaultProfile();
  }
  user.profile.notebooks.unshift(notebook);
  writeUsers(users);

  return res.status(201).json(notebook);
};

export const getNotebook = (req, res) => {
  const result = requireUser(req);
  if (result.error) {
    return res.status(result.error.status).json({ error: result.error.message });
  }

  const id = String(req.params.id);
  const notebooks = result.user.profile?.notebooks ?? [];
  const notebook = notebooks.find((item) => item.id === id);
  if (!notebook) {
    return res.status(404).json({ error: "Notebook not found" });
  }

  return res.json(notebook);
};

export const updateNotebook = (req, res) => {
  const result = requireUser(req);
  if (result.error) {
    return res.status(result.error.status).json({ error: result.error.message });
  }

  const users = result.users;
  const user = result.user;
  const id = String(req.params.id);
  const notebooks = user.profile?.notebooks ?? [];
  const notebook = notebooks.find((item) => item.id === id);
  if (!notebook) {
    return res.status(404).json({ error: "Notebook not found" });
  }

  if (typeof req.body?.title === "string") {
    notebook.title = req.body.title;
  }
  if (Array.isArray(req.body?.cells)) {
    notebook.cells = req.body.cells;
  }
  notebook.updatedAt = Date.now();
  writeUsers(users);

  return res.json(notebook);
};
