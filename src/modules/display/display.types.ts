import { DisplayLane } from '@prisma/client';

export type DisplayBoardRow = {
  lane: DisplayLane;
  ticket: string;
  displayName: string;
  place: string;
  waitingSince: string;
};

export function shortWaitingName(input: {
  firstName?: string | null;
  surname?: string | null;
}): string {
  const first = (input.firstName ?? '').trim();
  const surname = (input.surname ?? '').trim();
  const initial = surname ? `${surname.charAt(0).toUpperCase()}.` : '';
  const label = [first, initial].filter(Boolean).join(' ');
  return label || 'Patient';
}

export function laneTitle(lane: DisplayLane): string {
  switch (lane) {
    case 'TRIAGE':
      return 'Nurse triage';
    case 'CONSULTATION':
      return 'Consultation';
    case 'PHARMACY':
      return 'Pharmacy';
    case 'RADIOLOGY':
      return 'Radiology';
    case 'LAB':
      return 'Laboratory';
    case 'ALL':
      return 'Waiting patients';
  }
}
