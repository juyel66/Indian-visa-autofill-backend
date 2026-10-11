import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { formatErrorMessage } from '../utils/errorHandler';
import { extractApplicantNames } from '../utils/nameFormatter';
import { validatePhotoBuffer, parsePhotoInput } from '../utils/photoValidator';

/**
 * Extracts helper fields (applicantName, passportNumber) from complete Workspace applicationData
 * without altering or dropping any fields in the dynamic JSON.
 */
function extractSummaryFields(
  applicationData: any,
  explicitName?: string,
  explicitPassport?: string
): { applicantName: string | null; passportNumber: string | null } {
  let applicantName = explicitName || null;
  let passportNumber = explicitPassport || null;

  if (applicationData && typeof applicationData === 'object') {
    const fields = applicationData.fields || applicationData;

    if (!applicantName) {
      const surname = fields['appl.surname']?.value || fields['surname']?.value || '';
      const givenName =
        fields['appl.applname']?.value ||
        fields['appl.name']?.value ||
        fields['givenName']?.value ||
        fields['applicantName']?.value ||
        '';
      const fullName = `${givenName} ${surname}`.trim();
      applicantName = fullName || applicationData.applicantName || applicationData.name || null;
    }

    if (!passportNumber) {
      passportNumber =
        fields['appl.passno']?.value ||
        fields['appl.passportNumber']?.value ||
        fields['passport.number']?.value ||
        fields['passportNumber']?.value ||
        fields['passportNo']?.value ||
        applicationData.passportNumber ||
        null;
    }
  }

  return { applicantName, passportNumber };
}

/**
 * Validates whether a buffer appears to be a legitimate PDF by checking the magic byte signature.
 */
function isPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  return buffer.slice(0, 4).toString() === '%PDF';
}

/**
 * In-memory serialization lock per user and passport to eliminate concurrent
 * double-click and network retry race conditions without external dependencies.
 */
const saveLocks = new Map<string, Promise<void>>();

async function withSaveLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const current = saveLocks.get(key) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  saveLocks.set(key, next);

  try {
    await current;
    return await fn();
  } finally {
    release!();
    if (saveLocks.get(key) === next) {
      saveLocks.delete(key);
    }
  }
}

/**
 * POST /api/applications
 * Creates a new saved application with the complete dynamic Workspace JSON and original PDF.
 */
export async function createApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    let applicationData = req.body?.applicationData;
    if (typeof applicationData === 'string') {
      try {
        applicationData = JSON.parse(applicationData);
      } catch {
        res.status(400).json({ success: false, message: 'Invalid JSON in applicationData' });
        return;
      }
    }

    if (!applicationData || typeof applicationData !== 'object') {
      res.status(400).json({
        success: false,
        message: 'applicationData is required and must be a valid Workspace object.',
      });
      return;
    }

    let pdfBuffer: Buffer | null = null;
    let fileName = req.body?.originalPdfFileName || req.body?.fileName || 'passport.pdf';
    let mimeType = req.body?.originalPdfMimeType || req.body?.mimeType || 'application/pdf';

    // 1. Check if uploaded via multipart/form-data (multer)
    if (req.file) {
      pdfBuffer = req.file.buffer;
      fileName = req.file.originalname || fileName;
      mimeType = req.file.mimetype || mimeType;
    }
    // 2. Or uploaded via JSON base64 string
    else if (req.body?.originalPdf || req.body?.pdfBase64) {
      const base64Str = req.body.originalPdf || req.body.pdfBase64;
      const cleanBase64 = base64Str.replace(/^data:application\/pdf;base64,/, '');
      pdfBuffer = Buffer.from(cleanBase64, 'base64');
    }

    // Optional applicant photo input (multipart or base64)
    const photoFileInput =
      (req as any).photoFile ||
      (req.files as any)?.applicant_photo?.[0] ||
      (req.files as any)?.photo?.[0] ||
      (req.files as any)?.applicantPhoto?.[0];
    const photoBase64Input =
      req.body?.applicant_photo ||
      req.body?.applicantPhoto ||
      req.body?.photo;

    const photoParsed = parsePhotoInput(
      photoFileInput,
      typeof photoBase64Input === 'string' ? photoBase64Input : undefined,
      req.body?.applicant_photo_name || req.body?.applicantPhotoName,
      req.body?.applicant_photo_mime || req.body?.applicantPhotoMime
    );

    let photoBuffer: Buffer | null = null;
    let photoFileName: string | null = null;
    let photoMimeType: string | null = null;

    if (photoParsed) {
      const validation = validatePhotoBuffer(photoParsed.buffer, photoParsed.mimeType);
      if (!validation.valid) {
        const statusCode = validation.isTooLarge ? 413 : 400;
        res.status(statusCode).json({
          success: false,
          message: validation.error || 'Invalid applicant photo file',
        });
        return;
      }
      photoBuffer = photoParsed.buffer;
      photoFileName = photoParsed.fileName;
      photoMimeType = validation.mimeType || photoParsed.mimeType;
    }

    // Check if client provided an existing application ID (e.g. from existing saved application or retry)
    const targetId =
      req.body?.id ||
      req.body?.applicationId ||
      (typeof applicationData === 'object' && applicationData?.id ? applicationData.id : null);

    const { applicantName, passportNumber } = extractSummaryFields(
      applicationData,
      req.body?.applicantName,
      req.body?.passportNumber
    );

    const lockKey = `${userId}:${passportNumber || targetId || 'default'}`;

    await withSaveLock(lockKey, async () => {
      let existingApp: any = null;
      if (targetId && typeof targetId === 'string') {
        existingApp = await prisma.application.findFirst({
          where: { id: targetId, userId },
        });
      }

      // If no explicit ID matched, check for rapid retry / double-click within 15 seconds
      if (!existingApp && passportNumber) {
        const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
        existingApp = await prisma.application.findFirst({
          where: {
            userId,
            passportNumber,
            applicantName,
            createdAt: { gte: fifteenSecondsAgo },
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      // If updating an existing application, existing PDF is preserved if not re-uploaded
      if (!pdfBuffer || pdfBuffer.length === 0) {
        if (!existingApp || !existingApp.originalPdf) {
          res.status(400).json({
            success: false,
            message: 'Original passport PDF is required when saving an application.',
          });
          return;
        }
      } else if (!isPdfBuffer(pdfBuffer)) {
        res.status(400).json({
          success: false,
          message: 'The uploaded file is not a valid PDF document.',
        });
        return;
      }

      const status = req.body?.status || applicationData.status || 'draft';

      // If an existing application was identified, update it safely (prevents duplicates)
      if (existingApp) {
        const updateData: any = {
          applicationData,
          applicantName,
          passportNumber,
          status,
        };

        if (pdfBuffer && pdfBuffer.length > 0) {
          updateData.originalPdf = new Uint8Array(pdfBuffer);
          updateData.originalPdfFileName = fileName;
          updateData.originalPdfMimeType = mimeType;
        }

        if (photoBuffer && photoBuffer.length > 0) {
          updateData.applicant_photo = new Uint8Array(photoBuffer);
          updateData.applicant_photo_name = photoFileName;
          updateData.applicant_photo_mime = photoMimeType;
          updateData.applicant_photo_size = photoBuffer.length;
          updateData.applicant_photo_updated_at = new Date();
        }

        const updated = await prisma.application.update({
          where: { id: existingApp.id },
          data: updateData,
          select: {
            id: true,
            applicantName: true,
            passportNumber: true,
            status: true,
            applicant_photo_name: true,
            applicant_photo_mime: true,
            applicant_photo_size: true,
            applicant_photo_updated_at: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const hasPhoto = Boolean(updated.applicant_photo_name || updated.applicant_photo_mime);

        res.status(200).json({
          success: true,
          message: 'Application updated successfully',
          data: {
            id: updated.id,
            applicantName: updated.applicantName,
            passportNumber: updated.passportNumber,
            status: updated.status,
            applicant_photo_name: updated.applicant_photo_name,
            applicant_photo_mime: updated.applicant_photo_mime,
            applicantPhoto: {
              exists: hasPhoto,
              url: hasPhoto ? `/api/applications/${updated.id}/photo` : null,
              fileName: updated.applicant_photo_name || null,
              mimeType: updated.applicant_photo_mime || null,
              size: updated.applicant_photo_size ?? null,
              updatedAt: updated.applicant_photo_updated_at ? updated.applicant_photo_updated_at.toISOString() : null,
            },
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
        });
        return;
      }

      // Otherwise, create a new application record
      const createData: any = {
        userId,
        applicationData,
        originalPdf: new Uint8Array(pdfBuffer!),
        originalPdfFileName: fileName,
        originalPdfMimeType: mimeType,
        applicantName,
        passportNumber,
        status,
      };

      if (photoBuffer && photoBuffer.length > 0) {
        createData.applicant_photo = new Uint8Array(photoBuffer);
        createData.applicant_photo_name = photoFileName;
        createData.applicant_photo_mime = photoMimeType;
        createData.applicant_photo_size = photoBuffer.length;
        createData.applicant_photo_updated_at = new Date();
      }

      if (targetId && typeof targetId === 'string' && targetId.length === 36) {
        createData.id = targetId;
      }

      const application = await prisma.application.create({
        data: createData,
        select: {
          id: true,
          applicantName: true,
          passportNumber: true,
          status: true,
          applicant_photo_name: true,
          applicant_photo_mime: true,
          applicant_photo_size: true,
          applicant_photo_updated_at: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const hasPhoto = Boolean(application.applicant_photo_name || application.applicant_photo_mime);

      res.status(201).json({
        success: true,
        message: 'Application saved successfully',
        data: {
          id: application.id,
          applicantName: application.applicantName,
          passportNumber: application.passportNumber,
          status: application.status,
          applicant_photo_name: application.applicant_photo_name,
          applicant_photo_mime: application.applicant_photo_mime,
          applicantPhoto: {
            exists: hasPhoto,
            url: hasPhoto ? `/api/applications/${application.id}/photo` : null,
            fileName: application.applicant_photo_name || null,
            mimeType: application.applicant_photo_mime || null,
            size: application.applicant_photo_size ?? null,
            updatedAt: application.applicant_photo_updated_at ? application.applicant_photo_updated_at.toISOString() : null,
          },
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        },
      });
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to save application:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to save application', error),
    });
  }
}

/**
 * GET /api/applications
 * Returns lightweight list of applications for the authenticated user only.
 * Excludes heavy PDF bytes and applicant_photo bytes, and full applicationData.
 */
export async function getApplications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const applications = await prisma.application.findMany({
      where: { userId },
      select: {
        id: true,
        applicantName: true,
        passportNumber: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        applicationData: true,
        applicant_photo_name: true,
        applicant_photo_mime: true,
        applicant_photo_size: true,
        applicant_photo_updated_at: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedApplications = applications.map((app) => {
      let displayName = app.applicantName;
      if (app.applicationData) {
        const extracted = extractApplicantNames(app.applicationData, app.applicantName);
        if (extracted.fullName && extracted.fullName !== 'Unnamed Applicant') {
          displayName = extracted.fullName;
        }
      }
      const hasPhoto = Boolean(app.applicant_photo_name || app.applicant_photo_mime);
      return {
        id: app.id,
        applicantName: displayName,
        passportNumber: app.passportNumber,
        status: app.status,
        updatedAt: app.updatedAt,
        createdAt: app.createdAt,
        applicantPhoto: {
          exists: hasPhoto,
          url: hasPhoto ? `/api/applications/${app.id}/photo` : null,
          fileName: app.applicant_photo_name || null,
          mimeType: app.applicant_photo_mime || null,
          size: app.applicant_photo_size ?? null,
          updatedAt: app.applicant_photo_updated_at ? app.applicant_photo_updated_at.toISOString() : null,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: formattedApplications,
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to retrieve applications:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve applications', error),
    });
  }
}

/**
 * GET /api/applications/:id
 * Returns the complete saved application (including complete applicationData dynamic JSON)
 * for the authenticated user only. Excludes heavy raw binary fields.
 */
export async function getApplicationById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const id = String(req.params.id);

    const application = await prisma.application.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        applicationData: true,
        applicantName: true,
        passportNumber: true,
        status: true,
        originalPdfFileName: true,
        originalPdfMimeType: true,
        applicant_photo_name: true,
        applicant_photo_mime: true,
        applicant_photo_size: true,
        applicant_photo_updated_at: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!application) {
      res.status(404).json({
        success: false,
        message: 'Application not found or unauthorized',
      });
      return;
    }

    const hasPhoto = Boolean(application.applicant_photo_name || application.applicant_photo_mime);

    res.status(200).json({
      success: true,
      data: {
        id: application.id,
        userId: application.userId,
        applicationData: application.applicationData,
        applicantName: application.applicantName,
        passportNumber: application.passportNumber,
        status: application.status,
        originalPdfFileName: application.originalPdfFileName,
        originalPdfMimeType: application.originalPdfMimeType,
        applicant_photo_name: application.applicant_photo_name,
        applicant_photo_mime: application.applicant_photo_mime,
        applicantPhoto: {
          exists: hasPhoto,
          url: hasPhoto ? `/api/applications/${application.id}/photo` : null,
          fileName: application.applicant_photo_name || null,
          mimeType: application.applicant_photo_mime || null,
          size: application.applicant_photo_size ?? null,
          updatedAt: application.applicant_photo_updated_at ? application.applicant_photo_updated_at.toISOString() : null,
        },
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to retrieve application:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve application', error),
    });
  }
}

/**
 * PUT/PATCH /api/applications/:id
 * Updates an existing application owned by the authenticated user.
 * Preserves existing PDF and applicant_photo if not provided.
 */
export async function updateApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const id = String(req.params.id);

    // Verify existing record and ownership
    const existing = await prisma.application.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Application not found or unauthorized',
      });
      return;
    }

    const updateData: any = {};

    // 1. Process applicationData if supplied
    if (req.body?.applicationData) {
      let applicationData = req.body.applicationData;
      if (typeof applicationData === 'string') {
        try {
          applicationData = JSON.parse(applicationData);
        } catch {
          res.status(400).json({ success: false, message: 'Invalid JSON in applicationData' });
          return;
        }
      }
      updateData.applicationData = applicationData;

      const { applicantName, passportNumber } = extractSummaryFields(
        applicationData,
        req.body?.applicantName,
        req.body?.passportNumber
      );
      if (applicantName) updateData.applicantName = applicantName;
      if (passportNumber) updateData.passportNumber = passportNumber;
    } else {
      if (req.body?.applicantName !== undefined) updateData.applicantName = req.body.applicantName;
      if (req.body?.passportNumber !== undefined) updateData.passportNumber = req.body.passportNumber;
    }

    if (req.body?.status !== undefined) {
      updateData.status = req.body.status;
    }

    // 2. Check for PDF update (preserve existing if not sent)
    let newPdfBuffer: Buffer | null = null;
    if (req.file && (req.file.fieldname === 'pdf' || req.file.fieldname === 'originalPdf')) {
      newPdfBuffer = req.file.buffer;
      updateData.originalPdfFileName = req.file.originalname || existing.originalPdfFileName;
      updateData.originalPdfMimeType = req.file.mimetype || existing.originalPdfMimeType;
    } else if (req.body?.originalPdf || req.body?.pdfBase64) {
      const base64Str = req.body.originalPdf || req.body.pdfBase64;
      const cleanBase64 = base64Str.replace(/^data:application\/pdf;base64,/, '');
      newPdfBuffer = Buffer.from(cleanBase64, 'base64');
      if (req.body.originalPdfFileName) updateData.originalPdfFileName = req.body.originalPdfFileName;
      if (req.body.originalPdfMimeType) updateData.originalPdfMimeType = req.body.originalPdfMimeType;
    }

    if (newPdfBuffer) {
      if (!isPdfBuffer(newPdfBuffer)) {
        res.status(400).json({ success: false, message: 'The uploaded file is not a valid PDF document.' });
        return;
      }
      updateData.originalPdf = new Uint8Array(newPdfBuffer);
    }

    // 3. Check for Photo update or explicit removal
    const photoFileInput =
      (req as any).photoFile ||
      (req.files as any)?.applicant_photo?.[0] ||
      (req.files as any)?.photo?.[0] ||
      (req.files as any)?.applicantPhoto?.[0] ||
      (req.file && (req.file.fieldname === 'applicant_photo' || req.file.fieldname === 'photo') ? req.file : undefined);

    const photoBase64Input =
      req.body?.applicant_photo ||
      req.body?.applicantPhoto ||
      req.body?.photo;

    const shouldDeletePhoto =
      req.body?.delete_applicant_photo === true ||
      req.body?.delete_applicant_photo === 'true' ||
      req.body?.remove_applicant_photo === true ||
      req.body?.remove_applicant_photo === 'true' ||
      req.body?.deletePhoto === true ||
      req.body?.deletePhoto === 'true' ||
      req.body?.applicant_photo === null;

    if (shouldDeletePhoto) {
      updateData.applicant_photo = null;
      updateData.applicant_photo_name = null;
      updateData.applicant_photo_mime = null;
      updateData.applicant_photo_size = null;
      updateData.applicant_photo_updated_at = null;
    } else {
      const photoParsed = parsePhotoInput(
        photoFileInput,
        typeof photoBase64Input === 'string' ? photoBase64Input : undefined,
        req.body?.applicant_photo_name || req.body?.applicantPhotoName,
        req.body?.applicant_photo_mime || req.body?.applicantPhotoMime
      );

      if (photoParsed) {
        const validation = validatePhotoBuffer(photoParsed.buffer, photoParsed.mimeType);
        if (!validation.valid) {
          const statusCode = validation.isTooLarge ? 413 : 400;
          res.status(statusCode).json({
            success: false,
            message: validation.error || 'Invalid applicant photo file',
          });
          return;
        }
        updateData.applicant_photo = new Uint8Array(photoParsed.buffer);
        updateData.applicant_photo_name = photoParsed.fileName;
        updateData.applicant_photo_mime = validation.mimeType || photoParsed.mimeType;
        updateData.applicant_photo_size = photoParsed.buffer.length;
        updateData.applicant_photo_updated_at = new Date();
      }
    }

    const updated = await prisma.application.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        applicantName: true,
        passportNumber: true,
        status: true,
        applicant_photo_name: true,
        applicant_photo_mime: true,
        applicant_photo_size: true,
        applicant_photo_updated_at: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasPhoto = Boolean(updated.applicant_photo_name || updated.applicant_photo_mime);

    res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      data: {
        id: updated.id,
        applicantName: updated.applicantName,
        passportNumber: updated.passportNumber,
        status: updated.status,
        applicant_photo_name: updated.applicant_photo_name,
        applicant_photo_mime: updated.applicant_photo_mime,
        applicantPhoto: {
          exists: hasPhoto,
          url: hasPhoto ? `/api/applications/${updated.id}/photo` : null,
          fileName: updated.applicant_photo_name || null,
          mimeType: updated.applicant_photo_mime || null,
          size: updated.applicant_photo_size ?? null,
          updatedAt: updated.applicant_photo_updated_at ? updated.applicant_photo_updated_at.toISOString() : null,
        },
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to update application:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to update application', error),
    });
  }
}

/**
 * DELETE /api/applications/:id
 * Deletes an application owned by the authenticated user.
 */
export async function deleteApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const id = String(req.params.id);

    const deleteResult = await prisma.application.deleteMany({
      where: { id, userId },
    });

    if (deleteResult.count === 0) {
      res.status(404).json({
        success: false,
        message: 'Application not found or unauthorized',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Application deleted successfully',
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to delete application:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to delete application', error),
    });
  }
}

/**
 * GET /api/applications/:id/pdf
 * Streams original PDF bytes with appropriate content headers for authenticated owner.
 */
export async function downloadPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const id = String(req.params.id);

    const application = await prisma.application.findFirst({
      where: { id, userId },
      select: {
        originalPdf: true,
        originalPdfFileName: true,
        originalPdfMimeType: true,
      },
    });

    if (!application || !application.originalPdf) {
      res.status(404).json({
        success: false,
        message: 'PDF not found or unauthorized',
      });
      return;
    }

    const fileName = application.originalPdfFileName || 'passport.pdf';
    const mimeType = application.originalPdfMimeType || 'application/pdf';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', application.originalPdf.length);
    res.end(Buffer.from(application.originalPdf));
  } catch (error: any) {
    console.error('[ApplicationController] Failed to download PDF:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to download PDF', error),
    });
  }
}

/**
 * GET /api/applications/:id/photo
 * Streams applicant photo bytes with appropriate content headers for authenticated owner or authorized staff.
 */
export async function getApplicationPhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const id = String(req.params.id);
    const isStaff =
      req.user?.role &&
      ([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] as UserRole[]).includes(req.user.role);
    const where: any = isStaff ? { id } : { id, userId };

    const application = await prisma.application.findFirst({
      where,
      select: {
        applicant_photo: true,
        applicant_photo_name: true,
        applicant_photo_mime: true,
        applicant_photo_size: true,
      },
    });

    if (!application || !application.applicant_photo) {
      res.status(404).json({
        success: false,
        message: 'Applicant photo not found or unauthorized',
      });
      return;
    }

    const fileName = application.applicant_photo_name || 'applicant_photo.jpg';
    const mimeType = application.applicant_photo_mime || 'image/jpeg';
    const fileSize = application.applicant_photo_size || application.applicant_photo.length;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(Buffer.from(application.applicant_photo));
  } catch (error: any) {
    console.error('[ApplicationController] Failed to retrieve applicant photo:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve applicant photo', error),
    });
  }
}

/**
 * PUT/POST /api/applications/:id/photo
 * Dedicated endpoint for uploading or replacing the applicant photo.
 */
export async function updateApplicationPhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const id = String(req.params.id);
    const isStaff =
      req.user?.role &&
      ([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(req.user.role);
    const where: any = isStaff ? { id } : { id, userId };

    const existing = await prisma.application.findFirst({
      where,
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Application not found or unauthorized',
      });
      return;
    }

    const photoFileInput =
      req.file ||
      (req as any).photoFile ||
      (req.files as any)?.applicant_photo?.[0] ||
      (req.files as any)?.photo?.[0] ||
      (req.files as any)?.applicantPhoto?.[0] ||
      (req.files as any)?.file?.[0] ||
      (req.files as any)?.image?.[0];

    const photoBase64Input =
      req.body?.applicant_photo ||
      req.body?.photo ||
      req.body?.applicantPhoto ||
      req.body?.image;

    const photoParsed = parsePhotoInput(
      photoFileInput,
      typeof photoBase64Input === 'string' ? photoBase64Input : undefined,
      req.body?.applicant_photo_name || req.body?.applicantPhotoName,
      req.body?.applicant_photo_mime || req.body?.applicantPhotoMime
    );

    if (!photoParsed) {
      res.status(400).json({
        success: false,
        message: 'Applicant photo file or base64 data is required.',
      });
      return;
    }

    const validation = validatePhotoBuffer(photoParsed.buffer, photoParsed.mimeType);
    if (!validation.valid) {
      const statusCode = validation.isTooLarge ? 413 : 400;
      res.status(statusCode).json({
        success: false,
        message: validation.error || 'Invalid applicant photo file',
      });
      return;
    }

    const mimeType = validation.mimeType || photoParsed.mimeType;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        applicant_photo: new Uint8Array(photoParsed.buffer),
        applicant_photo_name: photoParsed.fileName,
        applicant_photo_mime: mimeType,
        applicant_photo_size: photoParsed.buffer.length,
        applicant_photo_updated_at: new Date(),
      },
      select: {
        id: true,
        applicant_photo_name: true,
        applicant_photo_mime: true,
        applicant_photo_size: true,
        applicant_photo_updated_at: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Applicant photo updated successfully',
      data: {
        id: updated.id,
        applicantPhoto: {
          exists: true,
          url: `/api/applications/${updated.id}/photo`,
          fileName: updated.applicant_photo_name,
          mimeType: updated.applicant_photo_mime,
          size: updated.applicant_photo_size,
          updatedAt: updated.applicant_photo_updated_at ? updated.applicant_photo_updated_at.toISOString() : null,
        },
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to update applicant photo:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to update applicant photo', error),
    });
  }
}

/**
 * DELETE /api/applications/:id/photo
 * Deletes the applicant photo from an application record without affecting applicationData or PDF.
 */
export async function deleteApplicationPhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const id = String(req.params.id);
    const isStaff =
      req.user?.role &&
      ([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(req.user.role);
    const where: any = isStaff ? { id } : { id, userId };

    const existing = await prisma.application.findFirst({
      where,
      select: { id: true, applicant_photo: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Application not found or unauthorized',
      });
      return;
    }

    await prisma.application.update({
      where: { id },
      data: {
        applicant_photo: null,
        applicant_photo_name: null,
        applicant_photo_mime: null,
        applicant_photo_size: null,
        applicant_photo_updated_at: null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Applicant photo deleted successfully',
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to delete applicant photo:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to delete applicant photo', error),
    });
  }
}

/**
 * POST /api/applicant_photo
 * Direct applicant photo upload endpoint for Chrome Extension and legacy integrations.
 * Resolves application ID from body, query, or headers, or attaches to the authenticated user's latest active application.
 */
export async function uploadApplicantPhotoDirect(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const isStaff =
      req.user?.role &&
      ([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(req.user.role);

    // 1. Resolve Target Application ID
    const explicitId =
      req.body?.applicationId ||
      req.body?.id ||
      req.body?.application_id ||
      req.query?.applicationId ||
      req.query?.id ||
      req.query?.application_id ||
      req.headers['x-application-id'];

    let targetApp: { id: string } | null = null;

    if (explicitId && typeof explicitId === 'string') {
      const where: any = isStaff ? { id: explicitId } : { id: explicitId, userId };
      targetApp = await prisma.application.findFirst({
        where,
        select: { id: true },
      });

      if (!targetApp) {
        res.status(404).json({
          success: false,
          message: 'Application not found or unauthorized',
        });
        return;
      }
    } else {
      // Find the user's most recent application
      targetApp = await prisma.application.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });

      if (!targetApp) {
        res.status(404).json({
          success: false,
          message: 'No application found for this user. Please save or create an application first.',
        });
        return;
      }
    }

    // 2. Parse photo input
    const photoFileInput =
      req.file ||
      (req as any).photoFile ||
      (req.files as any)?.applicant_photo?.[0] ||
      (req.files as any)?.photo?.[0] ||
      (req.files as any)?.applicantPhoto?.[0] ||
      (req.files as any)?.file?.[0] ||
      (req.files as any)?.image?.[0];

    const photoBase64Input =
      req.body?.applicant_photo ||
      req.body?.photo ||
      req.body?.applicantPhoto ||
      req.body?.image;

    const photoParsed = parsePhotoInput(
      photoFileInput,
      typeof photoBase64Input === 'string' ? photoBase64Input : undefined,
      req.body?.applicant_photo_name || req.body?.applicantPhotoName || req.body?.fileName,
      req.body?.applicant_photo_mime || req.body?.applicantPhotoMime || req.body?.mimeType
    );

    if (!photoParsed) {
      res.status(400).json({
        success: false,
        message: 'Applicant photo file or base64 data is required.',
      });
      return;
    }

    // 3. Validate photo buffer
    const validation = validatePhotoBuffer(photoParsed.buffer, photoParsed.mimeType);
    if (!validation.valid) {
      const statusCode = validation.isTooLarge ? 413 : 400;
      res.status(statusCode).json({
        success: false,
        message: validation.error || 'Invalid applicant photo file',
      });
      return;
    }

    const mimeType = validation.mimeType || photoParsed.mimeType;

    // 4. Update the application
    const updated = await prisma.application.update({
      where: { id: targetApp.id },
      data: {
        applicant_photo: new Uint8Array(photoParsed.buffer),
        applicant_photo_name: photoParsed.fileName,
        applicant_photo_mime: mimeType,
        applicant_photo_size: photoParsed.buffer.length,
        applicant_photo_updated_at: new Date(),
      },
      select: {
        id: true,
        applicant_photo_name: true,
        applicant_photo_mime: true,
        applicant_photo_size: true,
        applicant_photo_updated_at: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Applicant photo uploaded successfully',
      data: {
        id: updated.id,
        applicantPhoto: {
          exists: true,
          url: `/api/applications/${updated.id}/photo`,
          fileName: updated.applicant_photo_name,
          mimeType: updated.applicant_photo_mime,
          size: updated.applicant_photo_size,
          updatedAt: updated.applicant_photo_updated_at ? updated.applicant_photo_updated_at.toISOString() : null,
        },
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to upload applicant photo direct:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to upload applicant photo', error),
    });
  }
}

/**
 * GET /api/applicant_photo
 * Streams applicant photo directly for Chrome Extension / legacy clients.
 * Resolves application by query id or user's latest application.
 */
export async function getApplicantPhotoDirect(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const isStaff =
      req.user?.role &&
      ([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] as UserRole[]).includes(req.user.role);

    const explicitId =
      req.query?.applicationId ||
      req.query?.id ||
      req.query?.application_id ||
      req.headers['x-application-id'];

    let targetApp: {
      applicant_photo: Uint8Array | null;
      applicant_photo_name: string | null;
      applicant_photo_mime: string | null;
      applicant_photo_size: number | null;
    } | null = null;

    if (explicitId && typeof explicitId === 'string') {
      const where: any = isStaff ? { id: explicitId } : { id: explicitId, userId };
      targetApp = await prisma.application.findFirst({
        where,
        select: {
          applicant_photo: true,
          applicant_photo_name: true,
          applicant_photo_mime: true,
          applicant_photo_size: true,
        },
      });
    } else {
      targetApp = await prisma.application.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          applicant_photo: true,
          applicant_photo_name: true,
          applicant_photo_mime: true,
          applicant_photo_size: true,
        },
      });
    }

    if (!targetApp || !targetApp.applicant_photo) {
      res.status(404).json({
        success: false,
        message: 'Applicant photo not found or unauthorized',
      });
      return;
    }

    const fileName = targetApp.applicant_photo_name || 'applicant_photo.jpg';
    const mimeType = targetApp.applicant_photo_mime || 'image/jpeg';
    const fileSize = targetApp.applicant_photo_size || targetApp.applicant_photo.length;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(Buffer.from(targetApp.applicant_photo));
  } catch (error: any) {
    console.error('[ApplicationController] Failed to retrieve applicant photo direct:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve applicant photo', error),
    });
  }
}

/**
 * DELETE /api/applicant_photo
 * Deletes photo directly for Chrome Extension / legacy clients.
 */
export async function deleteApplicantPhotoDirect(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const isStaff =
      req.user?.role &&
      ([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(req.user.role);

    const explicitId =
      req.body?.applicationId ||
      req.body?.id ||
      req.query?.applicationId ||
      req.query?.id ||
      req.headers['x-application-id'];

    let targetId: string | null = null;

    if (explicitId && typeof explicitId === 'string') {
      const where: any = isStaff ? { id: explicitId } : { id: explicitId, userId };
      const app = await prisma.application.findFirst({ where, select: { id: true } });
      if (!app) {
        res.status(404).json({ success: false, message: 'Application not found or unauthorized' });
        return;
      }
      targetId = app.id;
    } else {
      const app = await prisma.application.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (!app) {
        res.status(404).json({ success: false, message: 'No application found for this user' });
        return;
      }
      targetId = app.id;
    }

    await prisma.application.update({
      where: { id: targetId },
      data: {
        applicant_photo: null,
        applicant_photo_name: null,
        applicant_photo_mime: null,
        applicant_photo_size: null,
        applicant_photo_updated_at: null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Applicant photo deleted successfully',
    });
  } catch (error: any) {
    console.error('[ApplicationController] Failed to delete applicant photo direct:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to delete applicant photo', error),
    });
  }
}

