export type LabSendStage =
  | 'QUEUED'
  | 'GENERATING_PDF'
  | 'UPLOADING_FILE'
  | 'SENDING_EMAIL'
  | 'SENDING_WHATSAPP'
  | 'SENT'
  | 'FAILED';

export type LabSendJobStatus = {
  jobId: string;
  stage: LabSendStage;
  message: string;
  /** 1-based step index for WhatsApp phone delivery (null when email-only). */
  step: number | null;
  totalSteps: number | null;
  error?: string;
  result?: {
    email: 'SENT' | 'SKIPPED' | 'FAILED';
    sms: 'SENT' | 'SKIPPED' | 'FAILED';
    whatsapp: 'SENT' | 'SKIPPED' | 'FAILED';
    pdfUrl?: string;
  };
};

export const LAB_SEND_STAGE_LABELS: Record<LabSendStage, string> = {
  QUEUED: 'Queued…',
  GENERATING_PDF: 'Generating lab result PDF…',
  UPLOADING_FILE: 'Storing document & generating link…',
  SENDING_EMAIL: 'Sending email…',
  SENDING_WHATSAPP: 'Transmitting document via WhatsApp Cloud API…',
  SENT: 'Message & document delivered to WhatsApp servers',
  FAILED: 'Delivery failed',
};
