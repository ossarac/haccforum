import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../server/models/User.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI_CLOUD;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in .env');
  process.exit(1);
}

const createAdmin = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const args = process.argv.slice(2);
    const email = args[0];
    const password = args[1];
    const name = args[2] || 'Admin';

    if (!email || !password) {
      console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> [name]');
      process.exit(1);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      name,
      passwordHash,
      roles: ['admin'],
      emailVerified: true
    });

    await user.save();
    console.log(`Admin user created: ${email}`);
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();
