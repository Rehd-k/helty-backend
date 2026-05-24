import { cascadeDeleteLabTests } from './lab-catalog-cascade.util';

describe('cascadeDeleteLabTests', () => {
  it('returns zeros when no test ids', async () => {
    const tx = {} as never;
    await expect(cascadeDeleteLabTests(tx, [])).resolves.toEqual({
      deletedResults: 0,
      deletedOrderItems: 0,
      deletedTests: 0,
      deletedEmptyOrders: 0,
    });
  });

  it('deletes tests with no versions without touching orders', async () => {
    const labTestVersion = { findMany: jest.fn().mockResolvedValue([]) };
    const labTest = {
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    };
    const tx = { labTestVersion, labTest } as never;

    const summary = await cascadeDeleteLabTests(tx, ['t1', 't2']);

    expect(labTestVersion.findMany).toHaveBeenCalled();
    expect(labTest.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1', 't2'] } },
    });
    expect(summary.deletedTests).toBe(2);
  });

  it('deletes results and order items before tests', async () => {
    const labTestVersion = {
      findMany: jest.fn().mockResolvedValue([{ id: 'v1' }]),
    };
    const labTestField = {
      findMany: jest.fn().mockResolvedValue([{ id: 'f1' }]),
    };
    const labOrderItem = {
      findMany: jest.fn().mockResolvedValue([{ id: 'oi1', orderId: 'o1' }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const labResult = {
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    };
    const labOrder = {
      findMany: jest.fn().mockResolvedValue([{ id: 'o1' }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const labTest = {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const tx = {
      labTestVersion,
      labTestField,
      labOrderItem,
      labResult,
      labOrder,
      labTest,
    } as never;

    const summary = await cascadeDeleteLabTests(tx, ['t1']);

    expect(labResult.deleteMany).toHaveBeenCalled();
    expect(labOrderItem.deleteMany).toHaveBeenCalled();
    expect(labTest.deleteMany).toHaveBeenCalled();
    expect(summary).toEqual({
      deletedResults: 3,
      deletedOrderItems: 1,
      deletedTests: 1,
      deletedEmptyOrders: 1,
    });
  });
});
