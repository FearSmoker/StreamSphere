const Joi = require("joi");
// validate required fields of videos schema from ./schema.js
const schema = Joi.object().keys({
  _id: Joi.string().optional(),
  title: Joi.string().min(3).max(120).required(),
  description: Joi.string().min(3).max(1000).required(),
  visibility: Joi.string().min(3).max(30).required(),
  category: Joi.string().min(3).max(30).required(),
  recordingDate: Joi.date().required(),
  contentType: Joi.string().valid('movie', 'episode').optional(),
  languages: Joi.array().items(Joi.string()).optional(),
  showId: Joi.string().optional(),
  seasonNumber: Joi.number().integer().optional(),
  episodeNumber: Joi.number().integer().optional(),
  language: Joi.string().optional(),
});

const validate = (data) => {
  const validationResult = schema.validate(data);
  return validationResult;
};

module.exports = {
  validate,
};
