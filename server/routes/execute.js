const vm = require("node:vm");

/** @type {{ when: number; items: Array<{ language: string; version: string; aliases?: string[] }> } | null } */
let runtimesCache = null;

async function getRuntimeVersion(language) {
  const now = Date.now();
  if (!runtimesCache || now - runtimesCache.when > 60_000) {
    const response = await fetch("https://emkc.org/api/v2/piston/runtimes");
    if (!response.ok) {
      throw new Error(`Piston runtimes error: ${response.status}`);
    }
    const items = await response.json();
    runtimesCache = { when: now, items: Array.isArray(items) ? items : [] };
  }

  const lang = String(language).toLowerCase();
  const match = runtimesCache.items.find((runtime) => {
    if (runtime.language?.toLowerCase() === lang) return true;
    return Array.isArray(runtime.aliases) && runtime.aliases.some((alias) => alias?.toLowerCase() === lang);
  });

  if (!match) {
    throw new Error(`Language not available in Piston: ${language}`);
  }

  return match.version;
}

async function runInPiston(language, code, stdin) {
  const version = await getRuntimeVersion(language);
  const response = await fetch("https://emkc.org/api/v2/piston/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language,
      version,
      files: [{ name: `main.${language}`, content: code }],
      stdin: stdin ?? "",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Piston error: ${response.status} ${body}`);
  }

  return response.json();
}

function runJavascript(code, stdin) {
  return new Promise((resolve) => {
    const logs = [];
    const errors = [];
    const context = vm.createContext({
      console: {
        log: (...args) => logs.push(args.map(String).join(" ")),
        error: (...args) => errors.push(args.map(String).join(" ")),
      },
      stdin: stdin ?? "",
      setTimeout,
      clearTimeout,
    });

    try {
      const script = new vm.Script(code, { filename: "cell.js" });
      script.runInContext(context, { timeout: 2000 });
    } catch (error) {
      errors.push(String(error?.stack || error?.message || error));
    }

    resolve({ stdout: logs.join("\n"), stderr: errors.join("\n") });
  });
}

const execute = async (req, res) => {
  const { language, code, stdin } = req.body ?? {};
  if (!language || !code) {
    return res.status(400).json({ error: "Missing language or code" });
  }

  try {
    const lang = String(language).toLowerCase();
    if (lang === "javascript" || lang === "js") {
      const output = await runJavascript(String(code), String(stdin ?? ""));
      return res.json({ language: "javascript", ...output });
    }
    if (lang === "python" || lang === "py") {
      const output = await runInPiston("python", String(code), String(stdin ?? ""));
      return res.json({ language: "python", stdout: output?.run?.stdout || "", stderr: output?.run?.stderr || "" });
    }
    if (lang === "cpp" || lang === "c++") {
      const output = await runInPiston("cpp", String(code), String(stdin ?? ""));
      return res.json({ language: "cpp", stdout: output?.run?.stdout || "", stderr: output?.run?.stderr || "" });
    }

    return res.status(400).json({ error: `Unsupported language: ${language}` });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
};

module.exports = { execute };