import { DepartmentService } from './department.service';

describe('DepartmentService', () => {
  it('update records acting staff as updatedBy', async () => {
    const prisma: any = {
      department: {
        update: jest.fn().mockResolvedValue({
          id: 'dep-1',
          name: 'ICU',
          updatedBy: { id: 'actor-1', firstName: 'A', lastName: 'B' },
        }),
      },
    };
    const service = new DepartmentService(prisma);
    await service.update(
      'dep-1',
      { name: 'ICU-2' } as any,
      'actor-1',
    );
    expect(prisma.department.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dep-1' },
        data: expect.objectContaining({
          name: 'ICU-2',
          updatedBy: { connect: { id: 'actor-1' } },
        }),
      }),
    );
  });
});
