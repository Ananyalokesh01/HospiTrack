const express = require('express');
const router = express.Router();
const db = require('../db');

// User submits emergency
router.post('/', async (req, res) => {
  const { name, phone, location, description } = req.body;
  try {
    await db.query(
      'INSERT INTO emergencies (name, phone, location, description, status) VALUES ($1, $2, $3, $4, $5)',
      [name, phone, location, description, 'pending']
    );
    res.status(201).json({ message: 'Emergency reported' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting emergency' });
  }
});

// Hospital fetches emergencies
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM emergencies WHERE status = $1', ['pending']);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching emergencies' });
  }
});

module.exports = router;
