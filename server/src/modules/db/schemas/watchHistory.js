const { baseSchema, ensureCollection } = require('./common');

const name = 'watchHistory';

const updateSchema = async (db) => {
  const validator = {
    $jsonSchema: {
      bsonType: 'object',
      additionalProperties: false,
      required: [
        'userId',
        'videoId',
        'progressSeconds',
        'durationSeconds',
        'completed',
        'lastWatchedAt',
        ...Object.keys(baseSchema),
      ],
      properties: {
        ...baseSchema,
        userId: {
          bsonType: 'objectId',
          description: 'must be an objectId of the User and is required',
        },
        videoId: {
          bsonType: 'objectId',
          description: 'must be an objectId of the Video and is required',
        },
        progressSeconds: {
          bsonType: ['int', 'double', 'long'],
          description: 'must be a number representing the current playback offset in seconds',
        },
        durationSeconds: {
          bsonType: ['int', 'double', 'long'],
          description: 'must be a number representing the total video length in seconds',
        },
        completed: {
          bsonType: 'bool',
          description: 'must be a boolean and is required',
        },
        lastWatchedAt: {
          bsonType: 'date',
          description: 'must be a date representing the last play event and is required',
        },
      },
    },
  };

  const indexes = [
    {
      key: { userId: 1, videoId: 1 },
      unique: true,
      name: `streamsphere_${name}_user_video_compound_index`,
    },
    {
      key: { lastWatchedAt: -1 },
      name: `streamsphere_${name}_last_watched_index`,
    },
    {
      key: { userId: 1, lastWatchedAt: -1 },
      name: `streamsphere_${name}_userId_lastWatchedAt_compound_index`,
    },
    {
      key: { userId: 1, completed: 1 },
      name: `streamsphere_${name}_userId_completed_compound_index`,
    },
  ];

  await ensureCollection({ db, name, validator, indexes });
};

module.exports = {
  updateSchema,
};
