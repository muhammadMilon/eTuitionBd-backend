import Notification from '../models/Notification.model.js';

/**
 * Create a new notification for a specific user.
 * @param {Object} params
 * @param {string} params.recipient - ID of the user receiving the notification
 * @param {string} params.type - Type of notification (application, payment, etc.)
 * @param {string} params.title - Title of the notification
 * @param {string} params.message - Content of the notification
 * @param {string} [params.sender] - ID of the user who triggered the notification
 * @param {string} [params.relatedId] - ID of the related object (e.g., Application ID)
 */
export const createNotification = async ({ recipient, type, title, message, sender, relatedId }) => {
  try {
    const notification = new Notification({
      recipient,
      type,
      title,
      message,
      sender,
      relatedId
    });
    
    await notification.save();
    
    // In a real application with WebSockets, you would emit the notification here
    // Example: io.to(recipient.toString()).emit('new_notification', notification);
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw error to avoid breaking the main flow
    return null;
  }
};
