import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { formatErrorMessage } from '../utils/errorHandler';
import { extractApplicantNames } from '../utils/nameFormatter';

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

        const updated = await prisma.application.update({
          where: { id: existingApp.id },
          data: updateData,
          select: {
            id: true,
            applicantName: true,
            passportNumber: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        res.status(200).json({
          success: true,
          message: 'Application updated successfully',
          data: updated,
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
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Application saved successfully',
        data: application,
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
 * Excludes heavy PDF bytes and full applicationData.
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
      return {
        id: app.id,
        applicantName: displayName,
        passportNumber: app.passportNumber,
        status: app.status,
        updatedAt: app.updatedAt,
        createdAt: app.createdAt,
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
 * for the authenticated user only.
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

    res.status(200).json({
      success: true,
      data: application,
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
 * Preserves existing PDF if not provided.
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

    // 2. Check for PDF update
    let newPdfBuffer: Buffer | null = null;
    if (req.file) {
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

    const updated = await prisma.application.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        applicantName: true,
        passportNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      data: updated,
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
