import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { HttpError } from '../utils/httpError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authorization = req.get('authorization') || ''
  const credentials = authorization.trim().split(/\s+/)
  if (credentials.length !== 2 || credentials[0] !== 'Bearer') {
    throw new HttpError(401, 'A bearer access token is required.')
  }

  let payload
  try {
    payload = jwt.verify(credentials[1], env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'learnly-api',
      audience: 'learnly-client',
    })
  } catch {
    throw new HttpError(401, 'Access token is invalid or expired.')
  }
  const user = await User.findById(payload.sub).select('+tokenVersion')
  if (!user || user.status === 'disabled' || user.tokenVersion !== payload.version) {
    throw new HttpError(401, 'This session is no longer valid.')
  }
  req.user = user
  next()
})

export const optionalAuthenticate = (req, res, next) => {
  if (!req.get('authorization')) return next()
  return authenticate(req, res, next)
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to perform this action.'))
    }
    next()
  }
}

export function requireApprovedTeacher(req, _res, next) {
  if (req.user?.role === 'teacher' && req.user.approvalStatus !== 'approved') {
    return next(new HttpError(403, 'Teacher account approval is required.'))
  }
  next()
}
