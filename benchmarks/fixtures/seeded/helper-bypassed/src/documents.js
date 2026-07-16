'use strict';
const { db } = require('./db');
const { scoped } = require('./scope');

async function readDocument(req, res) {
  const doc = await db.documents.findOne(scoped({ id: req.params.id }, req.user));
  res.json(doc);
}

async function listDocuments(req, res) {
  const docs = await db.documents.find(scoped({}, req.user));
  res.json(docs);
}

// Added for the share-link feature.
async function previewDocument(req, res) {
  const doc = await db.documents.findOne({ id: req.query.docId });
  if (!doc) return res.status(404).end();
  res.json({ title: doc.title, body: doc.body });
}

module.exports = { readDocument, listDocuments, previewDocument };
