import { prisma } from "../../prisma";
import { normalizeEmailKey } from "../../utils/normalizeUserIdentity";

/**
 * Reassigns every reference from `fromUserId` to `toUserId`, then deletes the duplicate user.
 * Keeps `toUserId` (typically the older / lower id). Use after identifying case-variant or trim-variant emails.
 */
export async function mergeUserInto(fromUserId: number, toUserId: number): Promise<void> {
  if (fromUserId === toUserId) {
    return;
  }

  await prisma.$transaction(async tx => {
    const dupDash = await tx.dashboardPreference.findUnique({ where: { userId: fromUserId } });
    const keepDash = await tx.dashboardPreference.findUnique({ where: { userId: toUserId } });
    if (dupDash) {
      if (keepDash) {
        await tx.dashboardPreference.delete({ where: { userId: fromUserId } });
      } else {
        await tx.dashboardPreference.update({
          where: { userId: fromUserId },
          data: { userId: toUserId },
        });
      }
    }

    const fromPrefs = await tx.notificationPreference.findMany({ where: { userId: fromUserId } });
    for (const pref of fromPrefs) {
      const clash = await tx.notificationPreference.findFirst({
        where: {
          userId: toUserId,
          triggerKey: pref.triggerKey,
        },
      });
      if (clash) {
        await tx.notificationPreference.delete({ where: { id: pref.id } });
      } else {
        await tx.notificationPreference.update({
          where: { id: pref.id },
          data: { userId: toUserId },
        });
      }
    }

    const fromAcks = await tx.policyAcknowledgement.findMany({ where: { userId: fromUserId } });
    for (const ack of fromAcks) {
      const clash = await tx.policyAcknowledgement.findFirst({
        where: { userId: toUserId, policyId: ack.policyId },
      });
      if (clash) {
        await tx.policyAcknowledgement.delete({ where: { id: ack.id } });
      } else {
        await tx.policyAcknowledgement.update({
          where: { id: ack.id },
          data: { userId: toUserId },
        });
      }
    }

    await tx.leadEmail.updateMany({
      where: { createdById: fromUserId },
      data: { createdById: toUserId },
    });

    await tx.oofStatus.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    });
    await tx.oofStatus.updateMany({
      where: { delegateUserId: fromUserId },
      data: { delegateUserId: toUserId },
    });

    await tx.lead.updateMany({
      where: { assignedToId: fromUserId },
      data: { assignedToId: toUserId },
    });
    await tx.leadNote.updateMany({
      where: { authorId: fromUserId },
      data: { authorId: toUserId },
    });

    await tx.opportunity.updateMany({
      where: { assignedToId: fromUserId },
      data: { assignedToId: toUserId },
    });
    await tx.opportunity.updateMany({
      where: { salesOwnerId: fromUserId },
      data: { salesOwnerId: toUserId },
    });
    await tx.opportunity.updateMany({
      where: { isrOwnerId: fromUserId },
      data: { isrOwnerId: toUserId },
    });

    await tx.quotation.updateMany({
      where: { createdById: fromUserId },
      data: { createdById: toUserId },
    });
    await tx.quoteApproval.updateMany({
      where: { approverId: fromUserId },
      data: { approverId: toUserId },
    });

    await tx.purchaseOrder.updateMany({
      where: { validatedById: fromUserId },
      data: { validatedById: toUserId },
    });
    await tx.purchaseOrder.updateMany({
      where: { scmOwnerId: fromUserId },
      data: { scmOwnerId: toUserId },
    });

    await tx.oemAlignment.updateMany({
      where: { ownerId: fromUserId },
      data: { ownerId: toUserId },
    });
    await tx.vendorQuote.updateMany({
      where: { ownerId: fromUserId },
      data: { ownerId: toUserId },
    });
    await tx.clientQuoteSubmission.updateMany({
      where: { ownerId: fromUserId },
      data: { ownerId: toUserId },
    });
    await tx.clientFollowUp.updateMany({
      where: { ownerId: fromUserId },
      data: { ownerId: toUserId },
    });

    await tx.opportunityStageHistory.updateMany({
      where: { changedById: fromUserId },
      data: { changedById: toUserId },
    });
    await tx.ovf.updateMany({
      where: { approvedById: fromUserId },
      data: { approvedById: toUserId },
    });

    await tx.warehouseReceipt.updateMany({
      where: { receivedById: fromUserId },
      data: { receivedById: toUserId },
    });
    await tx.scmExpense.updateMany({
      where: { approvedById: fromUserId },
      data: { approvedById: toUserId },
    });

    await tx.deployment.updateMany({
      where: { assignedTlId: fromUserId },
      data: { assignedTlId: toUserId },
    });
    await tx.balActivity.updateMany({
      where: { assignedEngineerId: fromUserId },
      data: { assignedEngineerId: toUserId },
    });
    await tx.uatTestCase.updateMany({
      where: { testedById: fromUserId },
      data: { testedById: toUserId },
    });
    await tx.deploymentStageHistory.updateMany({
      where: { changedById: fromUserId },
      data: { changedById: toUserId },
    });

    await tx.cloudEngagement.updateMany({
      where: { assignedTlId: fromUserId },
      data: { assignedTlId: toUserId },
    });
    await tx.cloudStageHistory.updateMany({
      where: { changedById: fromUserId },
      data: { changedById: toUserId },
    });
    await tx.scmStageHistory.updateMany({
      where: { changedById: fromUserId },
      data: { changedById: toUserId },
    });

    await tx.paymentFollowup.updateMany({
      where: { loggedById: fromUserId },
      data: { loggedById: toUserId },
    });

    await tx.project.updateMany({
      where: { assignedTlId: fromUserId },
      data: { assignedTlId: toUserId },
    });
    await tx.projectTask.updateMany({
      where: { assignedToId: fromUserId },
      data: { assignedToId: toUserId },
    });

    await tx.dailyUpdate.updateMany({
      where: { memberId: fromUserId },
      data: { memberId: toUserId },
    });
    await tx.dailyUpdate.updateMany({
      where: { validatedById: fromUserId },
      data: { validatedById: toUserId },
    });

    await tx.agreement.updateMany({
      where: { requestedById: fromUserId },
      data: { requestedById: toUserId },
    });
    await tx.policy.updateMany({
      where: { createdById: fromUserId },
      data: { createdById: toUserId },
    });

    await tx.attachment.updateMany({
      where: { ownerUserId: fromUserId },
      data: { ownerUserId: toUserId },
    });
    await tx.auditLog.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    });
    await tx.notification.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    });
    await tx.apiFetchSession.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    });

    await tx.user.updateMany({
      where: { reportsToId: fromUserId },
      data: { reportsToId: toUserId },
    });

    await tx.user.delete({ where: { id: fromUserId } });

    const keeper = await tx.user.findUnique({ where: { id: toUserId } });
    if (keeper) {
      const canonical = normalizeEmailKey(keeper.email);
      if (keeper.email !== canonical) {
        await tx.user.update({
          where: { id: toUserId },
          data: { email: canonical },
        });
      }
    }
  });
}
