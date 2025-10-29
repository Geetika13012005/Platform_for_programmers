const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid"); // ✅ only import once
const Notebook = require("../models/notebookModel");
const User = require("../models/userModels"); // ✅ ensure file name is userModel.js
const { verifyToken } = require("../config/isAuth");

// ---------------- GET ALL NOTEBOOKS (User's notebooks) ----------------
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await User.findById(userId).populate("notebooks");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.notebooks || []);
  } catch (error) {
    console.error("Error fetching notebooks:", error);
    res.status(500).json({ message: "Error fetching notebooks" });
  }
});

// ---------------- CREATE NEW NOTEBOOK ----------------
router.post("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { title, cells } = req.body;

    // ✅ Generate unique notebook ID
    const notebookId = `nbk_${uuidv4()}`;

    const notebook = new Notebook({
      id: notebookId,
      title: title || "Untitled Notebook",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cells:
        Array.isArray(cells) && cells.length > 0
          ? cells
          : [
              {
                id: `cell_${Date.now()}_${Math.random()
                  .toString(36)
                  .substr(2, 5)}`,
                language: "python",
                code: "print('Hello from Python!')",
              },
            ],
    });

    const savedNotebook = await notebook.save();

    // ✅ Add notebook reference to user's profile
    await User.findByIdAndUpdate(userId, {
      $push: { notebooks: savedNotebook._id },
    });

    // ✅ Send structured response back to frontend
    res.status(201).json({
      id: savedNotebook.id,
      _id: savedNotebook._id,
      title: savedNotebook.title,
      cells: savedNotebook.cells,
      createdAt: savedNotebook.createdAt,
      updatedAt: savedNotebook.updatedAt,
    });
  } catch (error) {
    console.error("Error creating notebook:", error);
    res.status(500).json({ message: "Error creating notebook" });
  }
});

// ---------------- GET NOTEBOOK BY ID ----------------
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const notebook = await Notebook.findOne({ id: req.params.id });
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }
    res.status(200).json(notebook);
  } catch (error) {
    console.error("Error fetching notebook:", error);
    res.status(500).json({ message: "Error fetching notebook" });
  }
});

// ---------------- UPDATE NOTEBOOK ----------------
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { title, cells } = req.body;

    const notebook = await Notebook.findOneAndUpdate(
      { id: req.params.id },
      {
        title: title || "Untitled Notebook",
        cells: cells || [],
        updatedAt: Date.now(),
      },
      { new: true }
    );

    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    res.status(200).json(notebook);
  } catch (error) {
    console.error("Error updating notebook:", error);
    res.status(500).json({ message: "Error updating notebook" });
  }
});

// ---------------- DELETE NOTEBOOK ----------------
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const notebook = await Notebook.findOne({ id: req.params.id });
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    await User.updateMany({}, { $pull: { notebooks: notebook._id } });
    await Notebook.findByIdAndDelete(notebook._id);

    res.status(200).json({ message: "Notebook deleted successfully" });
  } catch (error) {
    console.error("Error deleting notebook:", error);
    res.status(500).json({ message: "Error deleting notebook" });
  }
});

module.exports = router;
