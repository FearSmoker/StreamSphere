const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const { User } = require('../../db/collections');
const logger = require('../../../logger');

const createUser = async (userData) => {
  try {
    const { password, email, username, role, avatar, preferences } = userData;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      avatar: avatar || 'https://res.cloudinary.com/desk6uyon/image/upload/v1780977340/streamsphere/avatars/avatar_1.jpg',
      role: role || 'user',
      watchlist: [],
      preferences: preferences || { theme: 'dark', language: 'en' },
    };

    return await User.insert(newUser);
  } catch (error) {
    logger.error('Error in createUser service:', error);
    return error;
  }
};

const getUserByEmail = async (email) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    return user;
  } catch (error) {
    logger.error('Error in getUserByEmail service:', error);
    return error;
  }
};

const getUserById = async (id) => {
  try {
    const user = await User.findOne(
      { _id: new ObjectId(id), isDeleted: false },
      { projection: { password: 0 } }
    );
    return user;
  } catch (error) {
    logger.error('Error in getUserById service:', error);
    return error;
  }
};

const updateUser = async (id, updateData) => {
  try {
    const { password, email, ...allowedUpdates } = updateData;
    
    // Hash password if updating it
    if (password) {
      allowedUpdates.password = await bcrypt.hash(password, 10);
    }
    if (email) {
      allowedUpdates.email = email.toLowerCase();
    }

    const result = await User.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...allowedUpdates, updatedAt: new Date() } }
    );
    return result;
  } catch (error) {
    logger.error('Error in updateUser service:', error);
    return error;
  }
};

const addToWatchlist = async (userId, videoId) => {
  try {
    const result = await User.updateOne(
      { _id: new ObjectId(userId) },
      { $addToSet: { watchlist: new ObjectId(videoId) } }
    );
    return result;
  } catch (error) {
    logger.error('Error in addToWatchlist service:', error);
    return error;
  }
};

const removeFromWatchlist = async (userId, videoId) => {
  try {
    const result = await User.updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { watchlist: new ObjectId(videoId) } }
    );
    return result;
  } catch (error) {
    logger.error('Error in removeFromWatchlist service:', error);
    return error;
  }
};

// Find a user by their Google account ID.
const getUserByGoogleId = async (googleId) => {
  try {
    return await User.findOne({ googleId, isDeleted: false });
  } catch (error) {
    logger.error('Error in getUserByGoogleId service:', error);
    return error;
  }
};

// Upsert a Google OAuth user, linking the account if the email matches.
const upsertGoogleUser = async ({ googleId, email, name, picture }) => {
  try {
    // 1. Returning Google user
    let user = await User.findOne({ googleId });
    if (user) return user;

    // 2. Email exists from a local-auth account → link Google ID
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            googleId,
            authProvider: 'google',
            avatar: user.avatar || picture || 'https://res.cloudinary.com/desk6uyon/image/upload/v1780977340/streamsphere/avatars/avatar_1.jpg',
            updatedAt: new Date(),
          },
        }
      );
      return await User.findOne({ _id: user._id });
    }

    // 3. Brand-new Google user — create without password
    const baseUsername = (name || email.split('@')[0])
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 20);
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = `${baseUsername}${uniqueSuffix}`;

    const result = await User.insert({
      username,
      email: email.toLowerCase(),
      googleId,
      authProvider: 'google',
      avatar: picture || 'https://res.cloudinary.com/desk6uyon/image/upload/v1780977340/streamsphere/avatars/avatar_1.jpg',
      role: 'user',
      watchlist: [],
      preferences: { theme: 'dark', language: 'en' },
    });

    return await User.findOne({ _id: result.insertedId });
  } catch (error) {
    logger.error('Error in upsertGoogleUser service:', error);
    return error;
  }
};

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  addToWatchlist,
  removeFromWatchlist,
  getUserByGoogleId,
  upsertGoogleUser,
};
