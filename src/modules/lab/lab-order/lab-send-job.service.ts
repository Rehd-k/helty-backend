import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  LAB_SEND_STAGE_LABELS,
  LabSendJobStatus,
  LabSendStage,
} from './lab-send-progress.types';

const JOB_TTL_MS = 30 * 60 * 1000;

type InternalJob = LabSendJobStatus & {
  createdAt: number;
  updatedAt: number;
};

@Injectable()
export class LabSendJobService {
  private readonly logger = new Logger(LabSendJobService.name);
  private readonly jobs = new Map<string, InternalJob>();

  createQueued(): LabSendJobStatus {
    this.pruneExpired();
    const jobId = randomUUID();
    const now = Date.now();
    const job: InternalJob = {
      jobId,
      stage: 'QUEUED',
      message: LAB_SEND_STAGE_LABELS.QUEUED,
      step: null,
      totalSteps: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(jobId, job);
    return this.toPublic(job);
  }

  get(jobId: string): LabSendJobStatus {
    this.pruneExpired();
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Send job "${jobId}" not found.`);
    }
    return this.toPublic(job);
  }

  update(
    jobId: string,
    patch: Partial<
      Pick<
        LabSendJobStatus,
        'stage' | 'message' | 'step' | 'totalSteps' | 'error' | 'result'
      >
    >,
  ): LabSendJobStatus {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Send job "${jobId}" not found.`);
    }
    if (patch.stage) {
      job.stage = patch.stage;
      job.message =
        patch.message ?? LAB_SEND_STAGE_LABELS[patch.stage as LabSendStage];
    } else if (patch.message) {
      job.message = patch.message;
    }
    if (patch.step !== undefined) job.step = patch.step;
    if (patch.totalSteps !== undefined) job.totalSteps = patch.totalSteps;
    if (patch.error !== undefined) job.error = patch.error;
    if (patch.result !== undefined) job.result = patch.result;
    job.updatedAt = Date.now();
    return this.toPublic(job);
  }

  fail(jobId: string, error: string): LabSendJobStatus {
    this.logger.warn(`Lab send job failed jobId=${jobId}: ${error}`);
    return this.update(jobId, {
      stage: 'FAILED',
      message: LAB_SEND_STAGE_LABELS.FAILED,
      error,
    });
  }

  private toPublic(job: InternalJob): LabSendJobStatus {
    return {
      jobId: job.jobId,
      stage: job.stage,
      message: job.message,
      step: job.step,
      totalSteps: job.totalSteps,
      ...(job.error ? { error: job.error } : {}),
      ...(job.result ? { result: job.result } : {}),
    };
  }

  private pruneExpired(): void {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of this.jobs) {
      if (job.updatedAt < cutoff) this.jobs.delete(id);
    }
  }
}
