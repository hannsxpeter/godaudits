'use strict';
const { db } = require('./db');

async function getContact(req, res) {
  const contact = await db.contacts.findOne({ id: req.params.id, accountId: req.user.accountId });
  res.json(contact);
}

async function listContacts(req, res) {
  const contacts = await db.contacts.find({ accountId: req.user.accountId });
  res.json(contacts);
}

async function exportContacts(req, res) {
  const rows = await db.contacts.find({ segment: req.query.segment });
  res.setHeader('Content-Type', 'text/csv');
  res.send(rows.map((row) => `${row.name},${row.email},${row.phone}`).join('\n'));
}

module.exports = { getContact, listContacts, exportContacts };
