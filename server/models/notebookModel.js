const mongoose = require('mongoose');

const notebookCellSchema = new mongoose.Schema({
    id: { type: String, required: true,unique:true },
    language: { type: String, required: true },
    code: { type: String, required: true },
    stdout: { type: String },
    stderr: { type: String }
});

const notebookSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, default: "Untitled Notebook" },
    createdAt: { type: Number, default: Date.now },
    updatedAt: { type: Number, default: Date.now },
    cells: { type: [notebookCellSchema], default: [] }
});

const Notebook = mongoose.model('Notebook', notebookSchema);

module.exports = Notebook;