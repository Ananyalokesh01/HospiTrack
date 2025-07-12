// ✅ FINAL server.js — Real-time Emergency ↔ Hospital System with Socket.IO
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const db = require('./hospital-app/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(bodyParser.json());

// ===================== HOSPITAL SIGNUP =====================
app.post('/api/hospital/signup', async (req, res) => {
  const { name, phone, email, password, address } = req.body;
  try {
    const existing = await db.query('SELECT * FROM hospitals WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Hospital already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO hospitals (name, phone, email, password, address) VALUES ($1, $2, $3, $4, $5)',
      [name, phone, email, hashedPassword, address]
    );
    res.status(201).json({ message: 'Hospital registered successfully' });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===================== HOSPITAL LOGIN =====================
app.post('/api/hospital/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM hospitals WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'Hospital not found' });

    const hospital = result.rows[0];
    const isMatch = await bcrypt.compare(password, hospital.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    res.status(200).json({ message: 'Login successful' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===================== GET EMERGENCIES =====================
app.get('/api/emergencies', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM emergencies WHERE status = $1 ORDER BY id DESC', ['pending']);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===================== HOSPITAL RESPONDS =====================
app.post('/api/hospital/respond', async (req, res) => {
  const { emergencyId, hospitalEmail, isAvailable } = req.body;
  try {
    if (isAvailable) {
      await db.query('UPDATE emergencies SET status = $1 WHERE id = $2', ['accepted', emergencyId]);
      const hospitalResult = await db.query('SELECT name, phone, address FROM hospitals WHERE email = $1', [hospitalEmail]);
      const emergencyResult = await db.query('SELECT socket_id, phone FROM emergencies WHERE id = $1', [emergencyId]);

      // Debug logs
      console.log('--- Hospital Respond Debug ---');
      console.log('Hospital email:', hospitalEmail);
      console.log('Hospital query result:', hospitalResult.rows);
      console.log('Emergency query result:', emergencyResult.rows);

      if (hospitalResult.rows.length === 0) {
        console.error('❌ No hospital found for email:', hospitalEmail);
        return res.status(404).json({ message: 'Hospital not found for this email.' });
      }
      if (emergencyResult.rows.length === 0) {
        console.error('❌ No emergency found for ID:', emergencyId);
        return res.status(404).json({ message: 'Emergency not found for this ID.' });
      }

      const hospitalInfo = hospitalResult.rows[0];
      const userSocketId = emergencyResult.rows[0].socket_id;
      const userPhone = emergencyResult.rows[0].phone;

      if (!userSocketId) {
        console.error('❌ No socket_id found for emergency:', emergencyId);
        return res.status(500).json({ message: 'No socket_id found for this emergency.' });
      }

      const responseData = {
        emergencyId: parseInt(emergencyId),
        hospital: hospitalInfo,
        phone: userPhone
      };

      console.log('🏥 Sending hospital response to socket:', userSocketId);
      console.log('📱 User phone:', userPhone);
      console.log('🏥 Hospital info:', hospitalInfo);

      // Check if socket is still connected
      const socket = io.sockets.sockets.get(userSocketId);
      if (socket) {
        socket.emit('hospital-accepted', responseData);
        console.log('✅ Response sent successfully');
      } else {
        console.log('❌ Socket not found, user may have disconnected');
        // Fallback: emit to all connected clients and let client-side filter
        io.emit('hospital-accepted', responseData);
      }

      res.json({ status: 'accepted', hospital: hospitalInfo });
    } else {
      await db.query('UPDATE emergencies SET status = $1 WHERE id = $2', ['declined', emergencyId]);
      res.json({ status: 'declined' });
    }
  } catch (err) {
    console.error('❌ Hospital response error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

// ===================== SOCKET.IO =====================
io.on('connection', (socket) => {
  console.log('🧠 User connected:', socket.id);

  socket.on('emergency-submitted', async (data) => {
    const { name, phone, location, description } = data;
    try {
      const result = await db.query(
        'INSERT INTO emergencies (name, phone, location, description, status, socket_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, phone, location, description, 'pending', socket.id]
      );
      const newEmergency = result.rows[0];
      io.emit('new-emergency', newEmergency);
      socket.emit('emergency-registered', {
        emergencyId: newEmergency.id,
        message: 'Emergency registered successfully',
        status: 'pending'
      });
    } catch (err) {
      console.error('❌ Error saving emergency:', err.message);
      socket.emit('emergency-error', { message: 'Failed to register emergency' });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// ===================== SERVER START =====================
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
