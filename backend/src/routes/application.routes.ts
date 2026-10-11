import { Router } from 'express';
import multer from 'multer';
import {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
  downloadPdf,
  getApplicationPhoto,
  updateApplicationPhoto,
  deleteApplicationPhoto,
} from '../controllers/application.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

const uploadAppFilesMiddleware = (req: any, res: any, next: any) => {
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'originalPdf', maxCount: 1 },
    { name: 'applicant_photo', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'applicantPhoto', maxCount: 1 },
  ])(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error',
      });
    }
    if (req.files) {
      if (req.files.pdf && req.files.pdf[0]) {
        req.file = req.files.pdf[0];
      } else if (req.files.originalPdf && req.files.originalPdf[0]) {
        req.file = req.files.originalPdf[0];
      }

      if (req.files.applicant_photo && req.files.applicant_photo[0]) {
        req.photoFile = req.files.applicant_photo[0];
      } else if (req.files.photo && req.files.photo[0]) {
        req.photoFile = req.files.photo[0];
      } else if (req.files.applicantPhoto && req.files.applicantPhoto[0]) {
        req.photoFile = req.files.applicantPhoto[0];
      }
    }
    next();
  });
};

export const uploadPhotoOnlyMiddleware = (req: any, res: any, next: any) => {
  upload.fields([
    { name: 'applicant_photo', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'applicantPhoto', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ])(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error',
      });
    }
    if (req.files) {
      if (req.files.applicant_photo && req.files.applicant_photo[0]) {
        req.file = req.files.applicant_photo[0];
        req.photoFile = req.files.applicant_photo[0];
      } else if (req.files.photo && req.files.photo[0]) {
        req.file = req.files.photo[0];
        req.photoFile = req.files.photo[0];
      } else if (req.files.applicantPhoto && req.files.applicantPhoto[0]) {
        req.file = req.files.applicantPhoto[0];
        req.photoFile = req.files.applicantPhoto[0];
      } else if (req.files.file && req.files.file[0]) {
        req.file = req.files.file[0];
        req.photoFile = req.files.file[0];
      } else if (req.files.image && req.files.image[0]) {
        req.file = req.files.image[0];
        req.photoFile = req.files.image[0];
      }
    }
    next();
  });
};

// All Application routes require verified user JWT
router.use(requireAuth);

// Create new application (accepts PDF and optional applicant_photo)
router.post('/', uploadAppFilesMiddleware, createApplication);

// List user's applications (lightweight)
router.get('/', getApplications);

// Dedicated photo endpoints
router.get('/:id/photo', getApplicationPhoto);
router.put('/:id/photo', uploadPhotoOnlyMiddleware, updateApplicationPhoto);
router.post('/:id/photo', uploadPhotoOnlyMiddleware, updateApplicationPhoto);
router.delete('/:id/photo', deleteApplicationPhoto);

// Get single application with complete Workspace JSON
router.get('/:id', getApplicationById);

// Update existing application
router.put('/:id', uploadAppFilesMiddleware, updateApplication);
router.patch('/:id', uploadAppFilesMiddleware, updateApplication);

// Delete existing application
router.delete('/:id', deleteApplication);

// Download original passport PDF
router.get('/:id/pdf', downloadPdf);

export default router;
