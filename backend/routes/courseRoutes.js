import { Router } from 'express'
import {
  createCategory, createCourse, deleteCategory, deleteCourse, enroll, getCourse, listCategories,
  listCourses, listManagedCourses, updateCategory, updateCourse,
} from '../controllers/courseController.js'
import { authenticate, authorize, optionalAuthenticate, requireApprovedTeacher } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { categorySchema, courseSchema, courseUpdateSchema, idParamSchema, listSchema, updateCategorySchema } from '../validation/schemas.js'

const router = Router()

router.get('/categories', listCategories)
router.get('/admin/categories/list', authenticate, authorize('admin'), listCategories)
router.post('/admin/categories', authenticate, authorize('admin'), validate(categorySchema), createCategory)
router.patch('/admin/categories/:categoryId', authenticate, authorize('admin'), validate(updateCategorySchema), updateCategory)
router.delete('/admin/categories/:categoryId', authenticate, authorize('admin'), validate(idParamSchema('categoryId')), deleteCategory)
router.get('/manage', authenticate, authorize('teacher', 'admin'), requireApprovedTeacher, validate(listSchema), listManagedCourses)
router.post('/', authenticate, authorize('teacher', 'admin'), requireApprovedTeacher, validate(courseSchema), createCourse)
router.get('/:courseId', optionalAuthenticate, validate(idParamSchema('courseId')), getCourse)
router.patch('/:courseId', authenticate, authorize('teacher', 'admin'), requireApprovedTeacher, validate(courseUpdateSchema), updateCourse)
router.delete('/:courseId', authenticate, authorize('teacher', 'admin'), requireApprovedTeacher, validate(idParamSchema('courseId')), deleteCourse)
router.post('/:courseId/enroll', authenticate, authorize('student'), validate(idParamSchema('courseId')), enroll)
router.get('/', validate(listSchema), listCourses)

export default router
