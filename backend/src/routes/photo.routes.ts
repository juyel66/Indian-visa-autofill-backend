import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadPhotoOnlyMiddleware } from './application.routes';
import {
  uploadApplicantPhotoDirect,
  getApplicantPhotoDirect,
  deleteApplicantPhotoDirect,
} from '../controllers/application.controller';

const router = Router();

// All applicant photo routes require verified authentication
router.use(requireAuth);

// Direct compatibility endpoints for Chrome Extension (POST/PUT/GET/DELETE /api/applicant_photo)
router.post('/', uploadPhotoOnlyMiddleware, uploadApplicantPhotoDirect);
router.put('/', uploadPhotoOnlyMiddleware, uploadApplicantPhotoDirect);
router.get('/', getApplicantPhotoDirect);
router.delete('/', deleteApplicantPhotoDirect);

export default router;
