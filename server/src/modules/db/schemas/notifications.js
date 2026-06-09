const { baseSchema, ensureCollection } = require('./common');

const name = 'notifications';

const updateSchema = async (db) => {
  const validator = {
    $jsonSchema: {
      bsonType: 'object',
      additionalProperties: false,
      required: [
        'userId',
        'type',
        'title',
        'description',
        'isUnRead',
        ...Object.keys(baseSchema),
      ],
      properties: {
        ...baseSchema,
        userId: {
          bsonType: ['objectId', 'null', 'string'],
          description: 'user ID of the recipient or null for admin broadcast',
        },
        type: {
          bsonType: 'string',
          description: 'notification type identifier',
        },
        title: {
          bsonType: 'string',
          description: 'notification title',
        },
        description: {
          bsonType: 'string',
          description: 'notification body text',
        },
        isUnRead: {
          bsonType: 'bool',
          description: 'unread state indicator',
        },
      },
    },
  };

  const indexes = [
    {
      key: { userId: 1, createdAt: -1 },
      name: `streamsphere_${name}_userId_createdAt_index`,
    },
  ];

  await ensureCollection({ db, name, validator, indexes });
};

module.exports = {
  updateSchema,
};
