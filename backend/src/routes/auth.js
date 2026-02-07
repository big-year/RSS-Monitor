const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 登录
router.post('/login', [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const admin = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await pool.query(
      'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [admin.id]
    );

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email
        }
      },
      message: '登录成功'
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 修改密码
router.post('/change-password', [
  body('old_password').notEmpty().withMessage('旧密码不能为空'),
  body('new_password').isLength({ min: 6 }).withMessage('新密码至少6位')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { old_password, new_password } = req.body;

    const result = await pool.query(
      'SELECT * FROM admins WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const admin = result.rows[0];
    const isValidPassword = await bcrypt.compare(old_password, admin.password);

    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: '旧密码错误' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE admins SET password = $1 WHERE id = $2',
      [hashedPassword, decoded.id]
    );

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Error changing password:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: '无效的token' });
    }
    res.status(500).json({ success: false, message: '修改密码失败' });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await pool.query(
      'SELECT id, username, email, created_at, last_login FROM admins WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user info:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: '无效的token' });
    }
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

module.exports = router;
