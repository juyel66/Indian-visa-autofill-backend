import { Router } from 'express';
import multer from 'multer';
import {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
  downloadPdf,
} from '../controllers/application.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

const uploadPdfMiddleware = (req: any, res: any, next: any) => {
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'originalPdf', maxCount: 1 },
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
    }
    next();
  });
};

// All Application routes require verified user JWT
router.use(requireAuth);

// Create new application
router.post('/', uploadPdfMiddleware, createApplication);

// List user's applications (lightweight)
router.get('/', getApplications);

// Get single application with complete Workspace JSON
router.get('/:id', getApplicationById);

// Update existing application
router.put('/:id', uploadPdfMiddleware, updateApplication);
router.patch('/:id', uploadPdfMiddleware, updateApplication);

// Delete existing application
router.delete('/:id', deleteApplication);

// Download original passport PDF
router.get('/:id/pdf', downloadPdf);

export default router;
