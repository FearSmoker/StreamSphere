const Joi = require('joi');

const registerSchema = Joi.object().keys({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(30).required(),
  avatar: Joi.string().allow('', null).optional(),
  role: Joi.string().valid('user', 'admin').optional(),
  preferences: Joi.object().optional(),
});

const loginSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateSchema = Joi.object().keys({
  username: Joi.string().min(3).max(30).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).max(30).optional(),
  avatar: Joi.string().allow('', null).optional(),
  preferences: Joi.object().optional(),
});

const validateRegister = (data) => registerSchema.validate(data);
const validateLogin = (data) => loginSchema.validate(data);
const validateUpdate = (data) => updateSchema.validate(data);

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdate,
};
