'use strict';

const { google } = require('googleapis');
const logger = require('../../logger');

// Get OAuth2 client
const getOAuth2Client = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback'
  );

// Get Google auth URL
const getGoogleAuthUrl = () => {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  });
};

// Get Google profile
const getGoogleProfile = async (code) => {
  const oauth2Client = getOAuth2Client();

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch profile via People API
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  logger.info('[google-oauth] Profile fetched for:', data.email);

  return {
    googleId: data.id,
    email:    data.email,
    name:     data.name,
    picture:  data.picture,
  };
};

module.exports = { getGoogleAuthUrl, getGoogleProfile };
