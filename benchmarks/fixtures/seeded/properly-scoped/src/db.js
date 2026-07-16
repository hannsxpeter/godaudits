'use strict';
const db = { orders: { findOne: async () => null, find: async () => [], update: async () => ({ matched: 1 }) } };
module.exports = { db };
