import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { HttpError } from '../utils/httpError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

function signAccessToken(user) {
  return jwt.sign(
    { version: Number(user.tokenVersion || 0) },
    env.JWT_SECRET,
    { algorithm: 'HS256', subject: user.id, expiresIn: env.JWT_EXPIRES_IN, issuer: 'learnly-api', audience: 'learnly-client' },
  )
}

function authResponse(user) {
  return {
    token: signAccessToken(user),
    tokenType: 'Bearer',
    expiresIn: env.JWT_EXPIRES_IN,
    user,
  }
}

export const register = asyncHandler(async (req, res) => {
  const data = req.validated.body
  const existing = await User.exists({ email: data.email })
  if (existing) throw new HttpError(409, 'An account with this email already exists.')
  const passwordHash = await User.hashPassword(data.password)
  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role,
    approvalStatus: data.role === 'teacher' ? 'pending' : 'not_required',
    bio: data.bio || '',
    interests: data.interests || [],
  })
  res.status(201).json({ data: authResponse(user) })
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion')
  if (!user || !(await user.comparePassword(password))) throw new HttpError(401, 'Email or password is incorrect.')
  if (user.status !== 'active') throw new HttpError(403, 'This account has been disabled.')
  res.json({ data: authResponse(user) })
})

export const me = asyncHandler(async (req, res) => {
  res.json({ data: { user: req.user } })
})

export const logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } })
  res.json({ data: { message: 'Logged out. The current access token has been revoked.' } })
})

export const updateProfile = asyncHandler(async (req, res) => {
  const data = req.validated.body
  const fields = {}
  for (const key of ['name', 'bio', 'avatarUrl', 'interests']) {
    if (data[key] !== undefined) fields[key] = data[key]
  }
  if (data.newPassword) {
    const user = await User.findById(req.user.id).select('+passwordHash +tokenVersion')
    if (!(await user.comparePassword(data.currentPassword))) throw new HttpError(400, 'Current password is incorrect.')
    fields.passwordHash = await User.hashPassword(data.newPassword)
  }
  const update = { $set: fields }
  if (data.newPassword) update.$inc = { tokenVersion: 1 }
  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true })
  res.json({ data: { user, ...(data.newPassword ? { message: 'Password changed. Sign in again using your new password.' } : {}) } })
})
