const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'billard-ranking-jwt-secret-key-2024-change-in-production';

// Login
router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  db.get('SELECT * FROM admin LIMIT 1', [], (err, admin) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!admin) {
      return res.status(500).json({ error: 'Admin not configured' });
    }

    bcrypt.compare(password, admin.password_hash, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, message: 'Login successful' });
    });
  });
});

// Change password
router.post('/change-password', authenticateToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  db.get('SELECT * FROM admin LIMIT 1', [], (err, admin) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    bcrypt.compare(oldPassword, admin.password_hash, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ error: 'Invalid old password' });
      }

      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) {
          return res.status(500).json({ error: 'Error hashing password' });
        }

        db.run('UPDATE admin SET password_hash = ? WHERE id = ?', [hash, admin.id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error updating password' });
          }

          res.json({ message: 'Password changed successfully' });
        });
      });
    });
  });
});

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  });
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.JWT_SECRET = JWT_SECRET;
