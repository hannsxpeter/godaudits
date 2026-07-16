'use strict';
const express = require('express');
const { db } = require('./db');
const { requireSession } = require('./auth');

const app = express();
app.use(requireSession);

// Returns a patient record: name, date of birth, diagnosis notes.
app.get('/patients/:id', async (req, res) => {
  const patient = await db.patients.findOne({ id: req.params.id });
  if (!patient) return res.status(404).end();
  res.json(patient);
});

app.get('/patients', async (req, res) => {
  const patients = await db.patients.find({ clinicId: req.session.clinicId });
  res.json(patients);
});

module.exports = app;
