const { baseSchema, ensureCollection } = require('./common');

const { VIDEO_STATUS, VIDEO_VISIBILITIES } = require('../constant');

const name = 'videos';

// Video model properties schema definition.
const updateSchema = async (db) => {
  const validator = {
    $jsonSchema: {
      bsonType: 'object',
      additionalProperties: false,
      required: [
        'title',
        'fileName',
        'originalName',
        'visibility',
        'status',
        'recordingDate',
        'videoLink',
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
        viewCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'must be an integer',
        },
        visibility: {
          enum: Object.values(VIDEO_VISIBILITIES),
          description: 'can only be one of the enum values and is required',
        },
        duration: {
          bsonType: 'int',
          minimum: 0,
          description: 'must be an integer',
        },
        status: {
          enum: Object.values(VIDEO_STATUS),
          description: "can only be one of the enum values and is required",
        },
        playlistId: {
          bsonType: 'objectId',
          description: 'must be an objectId and is required',
        },
        language: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        recordingDate: {
          bsonType: 'date',
          description: 'must be a date and is required',
        },
        category: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        likesCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'must be an integer',
        },
        dislikesCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'must be an integer',
        },
        videoLink: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        fileName: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        originalName: {
          bsonType: 'string',
          description: 'must be a string and is required',
        },
        thumbnailUrl: {
          bsonType: 'string',
          description: 'must be a string',
        },
        thumbnailPath: {
          bsonType: 'string',
          description: 'must be a string',
        },
        processedPath: {
          bsonType: 'string',
          description: 'must be a string',
        },
        hlsPath: {
          bsonType: 'string',
          description: 'must be a string',
        },
        tags: {
          bsonType: 'array',
          description: 'must be an array',
        },
        publishedAt: {
          bsonType: 'date',
          description: 'must be a date',
        },
        history: {
          bsonType: 'array',
          description: 'must be a array',
        },
        resolution: {
          bsonType: 'object',
          description: 'video resolution metadata {width, height}',
        },
        processingError: {
          bsonType: 'string',
          description: 'error message if processing failed',
        },
        qualities: {
          bsonType: 'array',
          description: 'array of HLS quality renditions [{label, path, bandwidth, height}]',
        },
      },
    },
  };

  const indexes = [
    {
      key: { title: -1 },
      name: 'streamsphere_title_index',
    },
    {
      key: { title: 'text' },
      name: 'streamsphere_title_text_index',
    },
    {
      key: { visibility: -1 },
      name: 'streamsphere_visibility_index',
    },
    {
      key: { playlistId: -1 },
      name: 'streamsphere_playlistId_index',
    },
    {
      key: { recordingDate: -1 },
      name: 'streamsphere_recordingDate_index',
    },
    {
      key: { viewCount: -1 },
      name: 'streamsphere_viewCount_index',
    },
    {
      key: { status: -1 },
      name: 'streamsphere_status_index',
    },
    {
      key: { category: 1 },
      name: 'streamsphere_category_index',
    },
  ];

  await ensureCollection({ db, name, validator, indexes });
};

module.exports = {
  updateSchema,
};
