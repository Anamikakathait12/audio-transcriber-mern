import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas via Mongoose.
 * Validates MONGO_URI and manages connection events.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.warn('⚠️ [MongoDB] Warning: MONGO_URI is not set in your .env file.');
    console.warn('⚠️ [MongoDB] Please update server/.env with your MongoDB Atlas connection string.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ [MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ [MongoDB] Connection error: ${error.message}`);
    // Optional: exit process on fatal DB connection failure if required
    // process.exit(1);
  }
};

export default connectDB;

