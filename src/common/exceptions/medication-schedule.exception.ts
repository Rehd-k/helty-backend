import { HttpException, HttpStatus } from '@nestjs/common';

export type MedicationScheduleErrorCode =
  | 'COURSE_DURATION_EXPIRED'
  | 'INVALID_SCHEDULE_STATE'
  | 'MEDICATION_ORDER_NOT_FOUND';

export function medicationScheduleException(
  code: MedicationScheduleErrorCode,
  message: string,
  status: HttpStatus = HttpStatus.BAD_REQUEST,
  extra?: Record<string, unknown>,
): HttpException {
  return new HttpException(
    {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      code,
      message,
      ...extra,
    },
    status,
  );
}

export function courseDurationExpiredException(
  courseEndsAt: Date,
  medicationOrderId: string,
): HttpException {
  return medicationScheduleException(
    'COURSE_DURATION_EXPIRED',
    'Prescribed duration has ended. Obtain doctor consent before administering.',
    HttpStatus.CONFLICT,
    {
      courseEndsAt: courseEndsAt.toISOString(),
      medicationOrderId,
    },
  );
}
