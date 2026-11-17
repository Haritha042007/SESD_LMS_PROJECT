import { Router } from 'express'
import { createCertificate, listCertificates, verifyCertificate } from '../controllers/learningController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { certificateSchema, verifyCertificateSchema } from '../validation/schemas.js'

const router = Router()

router.get('/:certificateId/verify', validate(verifyCertificateSchema), verifyCertificate)
router.use(authenticate, authorize('student'))
router.get('/', listCertificates)
router.post('/:courseId', validate(certificateSchema), createCertificate)

export default router
