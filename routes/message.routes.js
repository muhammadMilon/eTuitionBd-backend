import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';
import Conversation from '../models/Conversation.model.js';
import Message from '../models/Message.model.js';
import { createNotification } from '../utils/notification.util.js';

const router = express.Router();

// Get or create a conversation between two users
router.post('/conversation', verifyFirebaseToken, async (req, res) => {
  try {
    const { participantId, tuitionId } = req.body;
    const currentUserId = req.userId;

    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, participantId] },
      tuitionId: tuitionId || null
    }).populate('participants', 'name photoUrl email');

    if (!conversation) {
      conversation = new Conversation({
        participants: [currentUserId, participantId],
        tuitionId: tuitionId || null
      });
      await conversation.save();
      await conversation.populate('participants', 'name photoUrl email');
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Get/Create conversation error:', error);
    res.status(500).json({ message: 'Failed to manage conversation', error: error.message });
  }
});

// Send a message
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const sender = req.userId;

    if (!conversationId || !content) {
      return res.status(400).json({ message: 'Conversation ID and content are required' });
    }

    const message = new Message({
      conversationId,
      sender,
      content
    });

    await message.save();

    // Update last message in conversation
    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      { lastMessage: message._id },
      { new: true }
    ).populate('participants', 'name');

    // Notify recipient
    const recipient = conversation.participants.find(p => p._id.toString() !== sender.toString());
    if (recipient) {
      const senderUser = conversation.participants.find(p => p._id.toString() === sender.toString());
      await createNotification({
        recipient: recipient._id,
        sender,
        type: 'message',
        title: 'New Message',
        message: `${senderUser.name} sent you a message.`,
        relatedId: conversationId
      });
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
});

// Get all messages for a conversation
router.get('/:conversationId', verifyFirebaseToken, async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId })
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
});

// Get all conversations for a user
router.get('/user/all', verifyFirebaseToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId
    })
      .populate('participants', 'name photoUrl email')
      .populate('lastMessage')
      .populate('tuitionId', 'title subject')
      .sort({ updatedAt: -1 });

    res.json({ conversations });
  } catch (error) {
    console.error('Get all conversations error:', error);
    res.status(500).json({ message: 'Failed to fetch conversations', error: error.message });
  }
});

export default router;
