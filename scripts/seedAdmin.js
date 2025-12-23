import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.model.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/etuitionbd';
    
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminEmail = 'admin@etuitionbd.com';
    const adminPassword = 'iloveph';
    const adminName = 'System Admin';
    const adminPhoto = 'https://ui-avatars.com/api/?name=System+Admin&background=0284c7&color=fff&size=128';

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Admin already exists');
      
      // Update existing admin
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      existingAdmin.password = hashedPassword;
      existingAdmin.role = 'admin';
      existingAdmin.isActive = true;
      existingAdmin.name = adminName;
      existingAdmin.photoUrl = adminPhoto;
      
      await existingAdmin.save();
      console.log('Admin updated successfully');
    } else {
      // Create new admin
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      const newAdmin = new User({
        uid: randomUUID(),
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'admin',
        isActive: true,
        isVerified: true,
        photoUrl: adminPhoto,
      });

      await newAdmin.save();
      console.log('Admin created successfully');
    }
    
    console.log('--------------------------------');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('--------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
