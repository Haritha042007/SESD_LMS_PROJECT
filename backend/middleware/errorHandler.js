import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

export function notFound(req, _res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`))
}

export function errorHandler(error, _req, res, _next) {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request body exceeds the 1 MB limit.' } })
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body contains invalid JSON.' } })
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: { message: 'Database validation failed.', details: Object.values(error.errors).map((item) => item.message) },
    })
  }
  if (error?.code === 11000) {
    return res.status(409).json({ error: { message: 'A record with that value already exists.' } })
  }
  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { message: 'Invalid resource identifier.' } })
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: { message: error.message, ...(error.details ? { details: error.details } : {}) },
    })
  }
  console.error('Unhandled API error:', error)
  return res.status(500).json({
    error: { message: 'An unexpected server error occurred.', ...(env.NODE_ENV === 'development' ? { details: error.message } : {}) },
  })
}
