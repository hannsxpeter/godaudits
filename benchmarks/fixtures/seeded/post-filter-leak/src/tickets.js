'use strict';
const { db } = require('./db');

async function getTicket(req, res) {
  const ticket = await db.tickets.findOne({ id: req.params.id });
  if (!ticket) return res.status(404).json({ error: 'No such ticket' });
  if (ticket.orgId !== req.user.orgId) {
    return res.status(403).json({ error: 'Ticket belongs to another organization' });
  }
  res.json(ticket);
}

module.exports = { getTicket };
