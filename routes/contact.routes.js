import express from 'express';
import { verifyFirebaseToken, verifyRole } from '../middleware/auth.middleware.js';
import ContactMessage from '../models/ContactMessage.model.js';

const router = express.Router();

// Submit a contact message (Public)
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newMessage = new ContactMessage({
      name,
      email,
      subject,
      message,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
    });

    await newMessage.save();

    res.status(201).json({ 
      message: 'Your message has been sent successfully. We will get back to you soon!',
      id: newMessage._id 
    });
  } catch (error) {
    console.error('Contact message submission error:', error);
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
});

// Get all contact messages (Admin only)
router.get('/', verifyFirebaseToken, verifyRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const messages = await ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ContactMessage.countDocuments(filter);

    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
});

// Update message status (Admin only)
router.patch('/:id/status', verifyFirebaseToken, verifyRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });

    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!message) return res.status(404).json({ message: 'Message not found' });

    res.json({ message: 'Status updated successfully', data: message });
  } catch (error) {
    console.error('Update contact message error:', error);
    res.status(500).json({ message: 'Failed to update message', error: error.message });
  }
});

// Delete a message (Admin only)
router.delete('/:id', verifyFirebaseToken, verifyRole('admin'), async (req, res) => {
  try {
    const message = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete contact message error:', error);
    res.status(500).json({ message: 'Failed to delete message', error: error.message });
  }
});

export default router;
