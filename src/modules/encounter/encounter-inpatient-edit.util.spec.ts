import { AdmissionStatus } from '@prisma/client';
import {
  isSharedInpatientEncounter,
  resolveOrderingDoctorId,
} from './encounter-inpatient-edit.util';

describe('encounter-inpatient-edit.util', () => {
  const activeAdmission = {
    admissionId: 'adm-1',
    admission: { status: AdmissionStatus.ACTIVE },
  };

  it('detects shared inpatient encounter', () => {
    expect(isSharedInpatientEncounter(activeAdmission)).toBe(true);
    expect(
      isSharedInpatientEncounter({
        admissionId: 'adm-1',
        admission: { status: AdmissionStatus.DISCHARGED },
      }),
    ).toBe(false);
    expect(
      isSharedInpatientEncounter({ admissionId: null, admission: null }),
    ).toBe(false);
  });

  it('resolves ordering doctor to acting staff on active admission', () => {
    expect(
      resolveOrderingDoctorId(activeAdmission, 'acting-1', 'original-doc'),
    ).toBe('acting-1');
  });

  it('keeps dto doctor id when not shared inpatient', () => {
    expect(
      resolveOrderingDoctorId(
        { admissionId: null, admission: null },
        'acting-1',
        'original-doc',
      ),
    ).toBe('original-doc');
  });
});
