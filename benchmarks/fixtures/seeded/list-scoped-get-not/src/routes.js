'use strict';
const { db } = require('./db');

async function listInvoices(req, res) {
  const invoices = await db.invoices.find({ tenantId: req.user.tenantId });
  res.json(invoices);
}

async function getInvoice(req, res) {
  const invoice = await db.invoices.findById(req.params.invoiceId);
  if (!invoice) return res.status(404).end();
  res.json(invoice);
}

async function updateInvoice(req, res) {
  await db.invoices.update({ id: req.params.invoiceId, tenantId: req.user.tenantId }, req.body);
  res.status(204).end();
}

module.exports = { listInvoices, getInvoice, updateInvoice };
