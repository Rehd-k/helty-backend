import { medicationOrderForAdmissionWhere, medicationOrdersForAdmissionWhere } from './admission-medication-order.util';

describe('admission-medication-order.util', () => {
  it('medicationOrdersForAdmissionWhere matches direct and encounter-linked orders', () => {
    expect(medicationOrdersForAdmissionWhere('adm-1')).toEqual({
      OR: [{ admissionId: 'adm-1' }, { encounter: { admissionId: 'adm-1' } }],
    });
  });

  it('medicationOrderForAdmissionWhere scopes a single order to the admission', () => {
    expect(medicationOrderForAdmissionWhere('order-1', 'adm-1')).toEqual({
      id: 'order-1',
      OR: [{ admissionId: 'adm-1' }, { encounter: { admissionId: 'adm-1' } }],
    });
  });
});
