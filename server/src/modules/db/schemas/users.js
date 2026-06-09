const { baseSchema, ensureCollection } = require('./common');

const name = 'users';

// Users collection schema supporting local auth and Google OAuth users.
const updateSchema = async (db) => {
  const validator = {
    $jsonSchema: {
      bsonType: 'object',
      additionalProperties: false,
      required: [
        'username',
        'email',
        'role',
        ...Object.keys(baseSchema),
      ],
      properties: {
        ...baseSchema,
        username: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        email: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        // Optional for Google OAuth users
        password: {
          bsonType: 'string',
          description: 'hashed password — only required for local auth users',
        },
        // OAuth fields
        googleId: {
          bsonType: 'string',
          description: 'Google account sub ID for OAuth users',
        },
        authProvider: {
          bsonType: 'string',
          enum: ['local', 'google'],
          description: 'authentication provider — local or google',
        },
        avatar: {
          bsonType: 'string',
          description: 'must be a string',
        },
        role: {
          enum: ['user', 'admin'],
          description: 'must be user or admin and is required',
        },
        watchlist: {
          bsonType: 'array',
          items: {
            bsonType: 'objectId',
          },
          description: 'must be an array of objectIds',
        },
        preferences: {
          bsonType: 'object',
          properties: {
            theme: {
              bsonType: 'string',
            },
            language: {
              bsonType: 'string',
            },
          },
          description: 'must be an object containing theme and language',
        },
      },
    },
  };

  const indexes = [
    {
      key: { username: 1 },
      unique: true,
      name: `streamsphere_${name}_username_index`,
    },
    {
      key: { email: 1 },
      unique: true,
      name: `streamsphere_${name}_email_index`,
    },
    {
      key: { googleId: 1 },
      unique: true,
      sparse: true, // Only index docs that have googleId (local-auth users don't)
      name: `streamsphere_${name}_googleId_index`,
    },
  ];

  await ensureCollection({ db, name, validator, indexes });
};

module.exports = {
  updateSchema,
};
