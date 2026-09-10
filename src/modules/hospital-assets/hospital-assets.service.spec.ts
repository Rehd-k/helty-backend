import { AccountType, StaffRole } from '@prisma/client';
import { HospitalAssetsService } from './hospital-assets.service';

describe('HospitalAssetsService access', () => {
  function serviceWith(
    actor: {
      id: string;
      accountType: AccountType;
      staffRole: StaffRole;
    },
    grants: { accountType: AccountType; canView: boolean; canLog: boolean }[],
  ) {
    const prisma = {
      staff: {
        findUnique: jest.fn().mockResolvedValue(actor),
      },
      hospitalAssetAccessGrant: {
        findMany: jest.fn().mockResolvedValue(grants),
      },
      hospitalAsset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    return new HospitalAssetsService(prisma as never);
  }

  it('gives lab head manage access only to laboratory', async () => {
    const svc = serviceWith(
      {
        id: '1',
        accountType: AccountType.LABORATORY,
        staffRole: StaffRole.LAB_HEAD,
      },
      [],
    );
    const access = await svc.resolveAccess({
      id: '1',
      accountType: AccountType.LABORATORY,
      staffRole: StaffRole.LAB_HEAD,
    });
    expect(access.manageAccountTypes).toEqual([AccountType.LABORATORY]);
    expect(access.viewAccountTypes).toEqual([AccountType.LABORATORY]);
  });

  it('lets a grantee view but not manage', async () => {
    const svc = serviceWith(
      {
        id: '2',
        accountType: AccountType.LABORATORY,
        staffRole: StaffRole.LAB_SCIENTIST,
      },
      [{ accountType: AccountType.LABORATORY, canView: true, canLog: false }],
    );
    const access = await svc.resolveAccess({
      id: '2',
      accountType: AccountType.LABORATORY,
      staffRole: StaffRole.LAB_SCIENTIST,
    });
    expect(access.viewAccountTypes).toEqual([AccountType.LABORATORY]);
    expect(access.logAccountTypes).toEqual([]);
    expect(access.manageAccountTypes).toEqual([]);
  });

  it('lets department staff view own inventory without a grant', async () => {
    const svc = serviceWith(
      {
        id: '2',
        accountType: AccountType.LABORATORY,
        staffRole: StaffRole.LAB_SCIENTIST,
      },
      [],
    );
    const access = await svc.resolveAccess({
      id: '2',
      accountType: AccountType.LABORATORY,
      staffRole: StaffRole.LAB_SCIENTIST,
    });
    expect(access.viewAccountTypes).toEqual([AccountType.LABORATORY]);
    expect(access.logAccountTypes).toEqual([]);
    expect(access.manageAccountTypes).toEqual([]);
  });

  it('ignores grants for a different department', async () => {
    const svc = serviceWith(
      {
        id: '2',
        accountType: AccountType.LABORATORY,
        staffRole: StaffRole.LAB_SCIENTIST,
      },
      [{ accountType: AccountType.PHARMACY, canView: true, canLog: true }],
    );
    const access = await svc.resolveAccess({
      id: '2',
      accountType: AccountType.LABORATORY,
      staffRole: StaffRole.LAB_SCIENTIST,
    });
    expect(access.viewAccountTypes).toEqual([AccountType.LABORATORY]);
    expect(access.logAccountTypes).toEqual([]);
  });

  it('gives CMAC and Director of Admin hospital-wide access', async () => {
    const cmac = serviceWith(
      { id: '4', accountType: AccountType.CMAC, staffRole: StaffRole.CMAC },
      [],
    );
    await expect(
      cmac.resolveAccess({
        id: '4',
        accountType: AccountType.CMAC,
        staffRole: StaffRole.CMAC,
      }),
    ).resolves.toMatchObject({ viewAccountTypes: 'ALL' });

    const da = serviceWith(
      {
        id: '5',
        accountType: AccountType.CMD,
        staffRole: StaffRole.CMD,
      },
      [],
    );
    const daAccess = await da.resolveAccess({
      id: '5',
      accountType: 'DA' as AccountType,
      staffRole: 'DIRECTOR_OF_ADMIN',
    });
    expect(daAccess.viewAccountTypes).toBe('ALL');
    expect(daAccess.manageAccountTypes).toBe('ALL');
  });

  it('rejects granting access to staff in another department', async () => {
    const prisma = {
      staff: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'lab-head',
            accountType: AccountType.LABORATORY,
            staffRole: StaffRole.LAB_HEAD,
          })
          .mockResolvedValueOnce({
            id: 'pharm',
            accountType: AccountType.PHARMACY,
          }),
      },
      hospitalAssetAccessGrant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const svc = new HospitalAssetsService(prisma as never);
    await expect(
      svc.upsertAccess('lab-head', {
        staffId: 'pharm',
        canView: true,
        canLog: true,
      }),
    ).rejects.toThrow(/that department/);
  });

  it('gives CMD hospital-wide access', async () => {
    const svc = serviceWith(
      { id: '3', accountType: AccountType.CMD, staffRole: StaffRole.CMD },
      [],
    );
    const access = await svc.resolveAccess({
      id: '3',
      accountType: AccountType.CMD,
      staffRole: StaffRole.CMD,
    });
    expect(access.viewAccountTypes).toBe('ALL');
    expect(access.manageAccountTypes).toBe('ALL');
  });

  it('does not treat CMD as a department inventory owner via list without type', async () => {
    const svc = serviceWith(
      { id: '3', accountType: AccountType.CMD, staffRole: StaffRole.CMD },
      [],
    );
    await expect(svc.list('3', {})).resolves.toEqual([]);
  });
});
