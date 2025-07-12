const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// Hospital Signup
router.post('/signup', async (req, res) => {
  const { name, phone, email, password, address } = req.body;
  try {
    const existing = await db.query('SELECT * FROM hospitals WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO hospitals (name, phone, email, password, address) VALUES ($1, $2, $3, $4, $5)',
      [name, phone, email, hashedPassword, address]
    );
    res.status(201).json({ message: 'Registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Signup error' });
  }
});

// Hospital Respond
router.post('/respond', async (req, res) => {
  const { emergencyId, hospitalEmail, isAvailable } = req.body;
  try {
    if (isAvailable) {
      await db.query('UPDATE emergencies SET status = $1 WHERE id = $2', ['accepted', emergencyId]);
      const hospital = await db.query(
        'SELECT name, phone, address FROM hospitals WHERE email = $1',
        [hospitalEmail]
      );
      res.json({ status: 'accepted', hospital: hospital.rows[0] });
    } else {
      res.json({ status: 'declined' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error in response' });
  }
});

module.exports = router;
