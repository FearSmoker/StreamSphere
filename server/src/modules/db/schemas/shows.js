'use strict';

const { baseSchema, ensureCollection } = require('./common');

const name = 'shows';

const updateSchema = async (db) => {
  const validator = {
    $jsonSchema: {
      bsonType: 'object',
      additionalProperties: false,
      required: [
        'title',
        'description',
        'thumbnailUrl',
        'coverUrl',
        'launchYear',
        'languages',
        'seasons',
        ...Object.keys(baseSchema),
      ],
      properties: {
        ...baseSchema,
        title: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        description: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        thumbnailUrl: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        coverUrl: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        launchYear: {
          bsonType: 'int',
          description: 'must be an integer and is required',
        },
        languages: {
          bsonType: 'array',
          items: { bsonType: 'string' },
          description: 'must be an array of strings and is required',
        },
        seasons: {
          bsonType: 'array',
          description: 'must be an array of seasons and is required',
          items: {
            bsonType: 'object',
            required: ['seasonNumber', 'episodes'],
            properties: {
              seasonNumber: {
                bsonType: 'int',
                description: 'must be an integer and is required',
              },
              episodes: {
                bsonType: 'array',
                description: 'must be an array of episodes and is required',
                items: {
                  bsonType: 'object',
                  required: ['episodeNumber', 'videoId'],
                  properties: {
                    episodeNumber: {
                      bsonType: 'int',
                      description: 'must be an integer and is required',
                    },
                    videoId: {
                      bsonType: 'objectId',
                      description: 'must be an objectId and is required',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const indexes = [
    {
      key: { title: -1 },
      name: 'streamsphere_shows_title_index',
    },
    {
      key: { title: 'text' },
      name: 'streamsphere_shows_title_text_index',
    },
    {
      key: { launchYear: -1 },
      name: 'streamsphere_shows_launchYear_index',
    },
  ];

  await ensureCollection({ db, name, validator, indexes });
};

module.exports = {
  updateSchema,
};
