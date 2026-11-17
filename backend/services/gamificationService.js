import { User } from '../models/User.js'

function utcDay(value) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

export async function awardStudyXp(studentId, points = 10, studiedAt = new Date()) {
  const user = await User.findById(studentId).select('+lastStudyDate')
  if (!user) return null
  const today = utcDay(studiedAt)
  const previous = user.lastStudyDate ? utcDay(user.lastStudyDate) : null
  const daysApart = previous ? Math.round((today - previous) / 86400000) : null
  if (daysApart !== 0) {
    user.streakDays = daysApart === 1 ? user.streakDays + 1 : 1
    user.lastStudyDate = studiedAt
  }
  user.xp += points
  const earned = []
  const milestones = [
    { id: 'first-100-xp', reached: user.xp >= 100 },
    { id: '500-xp', reached: user.xp >= 500 },
    { id: '1000-xp', reached: user.xp >= 1000 },
    { id: 'seven-day-streak', reached: user.streakDays >= 7 },
    { id: 'thirty-day-streak', reached: user.streakDays >= 30 },
  ]
  for (const milestone of milestones) {
    if (milestone.reached && !user.badges.includes(milestone.id)) {
      user.badges.push(milestone.id)
      earned.push(milestone.id)
    }
  }
  await user.save()
  return { xp: user.xp, streakDays: user.streakDays, badges: earned }
}
