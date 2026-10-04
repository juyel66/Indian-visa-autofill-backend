import { prisma } from '../lib/prisma';

export interface CreateAuditLogParams {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}

export async function logAuditEvent({
  actorUserId,
  action,
  targetType,
  targetId,
  metadata,
}: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    // Non-blocking: audit log failure should not crash main request
    console.error('Failed to write audit log:', error);
    return null;
  }
}
