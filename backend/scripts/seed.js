import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { Category } from '../models/Category.js'
import { CodingProblem } from '../models/CodingProblem.js'
import { Course } from '../models/Course.js'
import { Enrollment } from '../models/Enrollment.js'
import { User } from '../models/User.js'

const demoUsers = [
  { name: 'Learnly Admin', email: 'admin@learnly.test', role: 'admin', passwordKey: 'SEED_ADMIN_PASSWORD' },
  { name: 'Olivia Rhye', email: 'teacher@learnly.test', role: 'teacher', approvalStatus: 'approved', passwordKey: 'SEED_TEACHER_PASSWORD' },
  { name: 'Haritha', email: 'haritha@learnly.test', role: 'student', approvalStatus: 'not_required', passwordKey: 'SEED_STUDENT_PASSWORD', xp: 1240, streakDays: 7, badges: ['first-100-xp', '500-xp', '1000-xp', 'seven-day-streak'], lastStudyDate: new Date() },
]

const courseSeeds = [
  {
    title: 'Software Engineering and System Design',
    category: 'Software Engineering',
    level: 'Beginner',
    description: 'Explore software development practices, system architecture, design patterns, and building reliable applications.',
    objectives: ['Explain the software development lifecycle', 'Design reliable service boundaries', 'Apply common architectural patterns'],
    topics: ['System design', 'Architecture basics', 'Design patterns'],
  },
  {
    title: 'Statistics',
    category: 'Statistics',
    level: 'Beginner',
    description: 'Build a strong foundation in probability, descriptive statistics, distributions, and drawing insights from data.',
    objectives: ['Summarize data with descriptive statistics', 'Apply basic probability', 'Interpret common distributions'],
    topics: ['Descriptive statistics', 'Probability', 'Distributions'],
  },
  {
    title: 'Algorithms',
    category: 'Algorithms',
    level: 'Intermediate',
    description: 'Learn essential algorithms, data structures, complexity analysis, and practical problem-solving techniques.',
    objectives: ['Analyze time and space complexity', 'Choose suitable data structures', 'Implement and compare algorithms'],
    topics: ['Complexity analysis', 'Sorting', 'Graph algorithms'],
  },
  {
    title: 'Critical Thinking',
    category: 'Critical Thinking',
    level: 'Beginner',
    description: 'Strengthen reasoning, evaluate evidence, identify assumptions, and make well-supported decisions.',
    objectives: ['Evaluate arguments and evidence', 'Recognize assumptions and bias', 'Communicate reasoned conclusions'],
    topics: ['Reasoning', 'Evidence evaluation', 'Decision making'],
  },
  {
    title: 'Artificial Intelligence and Deep Learning',
    category: 'Artificial Intelligence',
    level: 'Intermediate',
    description: 'Discover machine learning foundations, neural networks, and deep learning applications through practical examples.',
    objectives: ['Describe neural network components', 'Compare supervised learning approaches', 'Evaluate model performance'],
    topics: ['Machine learning', 'Neural networks', 'Model evaluation'],
  },
]

const codingProblemSeeds = [
  {
    title: 'Add Two Numbers',
    difficulty: 'beginner',
    description: 'Read two integers and print their sum. This exercise practices reading input and producing output.',
    inputDescription: 'One line containing two space-separated integers a and b.',
    outputDescription: 'Print a + b.',
    sampleCases: [{ input: '3 5\n', output: '8\n' }],
    testCases: [{ input: '3 5\n', output: '8\n' }, { input: '-4 9\n', output: '5\n' }],
    starterCode: { python: 'a, b = map(int, input().split())\n# Print the sum\n', c: '#include <stdio.h>\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    // Print the sum\n    return 0;\n}\n', cpp: '#include <iostream>\nusing namespace std;\nint main() {\n    int a, b;\n    cin >> a >> b;\n    // Print the sum\n    return 0;\n}\n', java: 'import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt(), b = sc.nextInt();\n        // Print the sum\n    }\n}\n' },
  },
  {
    title: 'Count Vowels',
    difficulty: 'intermediate',
    description: 'Read a line of text and count how many vowels it contains. Treat uppercase and lowercase vowels equally.',
    inputDescription: 'One line of text containing English letters and spaces.',
    outputDescription: 'Print the number of vowels (a, e, i, o, u).',
    sampleCases: [{ input: 'Learning is fun\n', output: '5\n' }],
    testCases: [{ input: 'Learning is fun\n', output: '5\n' }, { input: 'AEIOU\n', output: '5\n' }],
    starterCode: { python: 'text = input()\n# Count and print the vowels\n' },
  },
  {
    title: 'Longest Increasing Subsequence Length',
    difficulty: 'advanced',
    description: 'Given an integer array, find the length of its longest strictly increasing subsequence. The selected values do not need to be adjacent.',
    inputDescription: 'First line: n. Second line: n space-separated integers.',
    outputDescription: 'Print the length of the longest strictly increasing subsequence.',
    sampleCases: [{ input: '8\n10 9 2 5 3 7 101 18\n', output: '4\n' }],
    testCases: [{ input: '8\n10 9 2 5 3 7 101 18\n', output: '4\n' }, { input: '5\n5 4 3 2 1\n', output: '1\n' }],
    starterCode: { python: 'n = int(input())\nvalues = list(map(int, input().split()))\n# Compute and print the LIS length\n' },
  },
]

async function main() {
  const missingPasswords = demoUsers
    .filter((user) => typeof process.env[user.passwordKey] !== 'string' || process.env[user.passwordKey].length < 12)
    .map((user) => user.passwordKey)
  if (missingPasswords.length) {
    throw new Error(`Set unique passwords of at least 12 characters in: ${missingPasswords.join(', ')}`)
  }
  const seedPasswords = demoUsers.map((user) => process.env[user.passwordKey])
  if (new Set(seedPasswords).size !== seedPasswords.length) {
    throw new Error('Each demo account must have a different seed password.')
  }

  await connectDatabase()
  const seeded = {}
  for (const entry of demoUsers) {
    const passwordHash = await User.hashPassword(process.env[entry.passwordKey])
    const { passwordKey, ...profile } = entry
    const user = await User.findOneAndUpdate(
      { email: entry.email },
      { $set: { ...profile, passwordHash, status: 'active' }, $setOnInsert: { interests: [] } },
      { upsert: true, new: true, runValidators: true },
    )
    seeded[entry.role] = user
  }

  const categories = [...new Set(courseSeeds.map((course) => course.category))]
  for (const name of categories) {
    await Category.updateOne({ name }, { $setOnInsert: { name, description: `${name} learning resources.` } }, { upsert: true })
  }

  const seededCourses = []
  for (const data of courseSeeds) {
    const lessons = data.topics.map((topic, index) => ({
      title: [`Foundations of ${topic}`, `Core concepts: ${topic}`, `Practice: ${topic}`][index],
      description: `Learn and apply ${topic.toLowerCase()} in ${data.title}.`,
      durationMinutes: 15 + index * 5,
      topic,
      resources: [],
    }))
    const course = await Course.findOneAndUpdate(
      { title: data.title, teacher: seeded.teacher.id },
      { $set: { ...data, lessons, status: 'published', teacher: seeded.teacher.id } },
      { upsert: true, new: true, runValidators: true },
    )
    seededCourses.push(course)
  }

  const firstCourse = seededCourses[0]
  await Enrollment.updateOne(
    { student: seeded.student.id, course: firstCourse.id },
    { $setOnInsert: { student: seeded.student.id, course: firstCourse.id, completedLessons: [firstCourse.lessons[0]._id] } },
    { upsert: true },
  )
  const secondCourse = seededCourses[1]
  await Enrollment.updateOne(
    { student: seeded.student.id, course: secondCourse.id },
    { $setOnInsert: { student: seeded.student.id, course: secondCourse.id, completedLessons: [] } },
    { upsert: true },
  )
  for (const course of seededCourses) {
    const enrollmentCount = await Enrollment.countDocuments({ course: course.id })
    await Course.updateOne({ _id: course.id }, { $set: { enrollmentCount } })
  }

  for (const data of codingProblemSeeds) {
    await CodingProblem.findOneAndUpdate(
      { title: data.title, author: seeded.teacher.id },
      { $set: { ...data, published: true, author: seeded.teacher.id } },
      { upsert: true, new: true, runValidators: true },
    )
  }

  console.info('Seed complete.')
  console.info('Demo accounts:')
  for (const user of demoUsers) console.info(`  ${user.role}: ${user.email} (password is set with ${user.passwordKey})`)
  console.info(`Courses seeded: ${seededCourses.length}`)
  console.info(`Coding problems seeded: ${codingProblemSeeds.length}`)
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await disconnectDatabase()
  })
