'use strict';
const { db } = require('./db');

async function getOrder(req, res) {
  const order = await db.orders.findOne({ id: req.params.id, customerId: req.user.customerId });
  if (!order) return res.status(404).end();
  res.json(order);
}

async function listOrders(req, res) {
  const orders = await db.orders.find({ customerId: req.user.customerId });
  res.json(orders);
}

async function cancelOrder(req, res) {
  const result = await db.orders.update(
    { id: req.params.id, customerId: req.user.customerId },
    { status: 'cancelled' }
  );
  if (!result.matched) return res.status(404).end();
  res.status(204).end();
}

async function exportOrders(req, res) {
  const rows = await db.orders.find({ customerId: req.user.customerId });
  res.send(rows.map((row) => `${row.id},${row.total}`).join('\n'));
}

module.exports = { getOrder, listOrders, cancelOrder, exportOrders };
