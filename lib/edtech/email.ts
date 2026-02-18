import { Resend } from "resend";

import { hasResend, runtimeEnv } from "@/lib/env";
import { logInfo } from "@/lib/observability/logger";

export type CampaignNotificationTarget = {
  email: string;
  assignmentId: string;
  campaignName: string;
};

function getResendClient(): Resend | null {
  if (!hasResend()) {
    return null;
  }

  return new Resend(runtimeEnv.resendApiKey);
}

export async function sendCampaignInvites(
  recipients: CampaignNotificationTarget[],
  requestId: string,
): Promise<number> {
  const client = getResendClient();
  if (!client) {
    logInfo("email_provider_not_configured", {
      request_id: requestId,
      route: "email",
      event: "invite_skip",
    });
    return 0;
  }

  let sent = 0;
  for (const recipient of recipients) {
    await client.emails.send({
      from: runtimeEnv.resendFromEmail,
      to: recipient.email,
      subject: `Action required: ${recipient.campaignName}`,
      html: `<p>You have a new AI compliance learning assignment.</p><p><a href="${runtimeEnv.siteUrl}/learn/${recipient.assignmentId}">Open assignment</a></p>`,
    });
    sent += 1;
  }

  return sent;
}

export async function sendReminderEmail(
  recipients: CampaignNotificationTarget[],
  requestId: string,
): Promise<number> {
  const client = getResendClient();
  if (!client) {
    logInfo("email_provider_not_configured", {
      request_id: requestId,
      route: "email",
      event: "reminder_skip",
    });
    return 0;
  }

  let sent = 0;
  for (const recipient of recipients) {
    await client.emails.send({
      from: runtimeEnv.resendFromEmail,
      to: recipient.email,
      subject: `Reminder: complete ${recipient.campaignName}`,
      html: `<p>This is a reminder to complete your learning assignment.</p><p><a href="${runtimeEnv.siteUrl}/learn/${recipient.assignmentId}">Resume assignment</a></p>`,
    });
    sent += 1;
  }

  return sent;
}
