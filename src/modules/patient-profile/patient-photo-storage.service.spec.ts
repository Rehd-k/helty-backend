import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import { PatientPhotoStorageService } from './patient-photo-storage.service';

describe('PatientPhotoStorageService', () => {
  const patientId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  let tmpUploads: string;
  let service: PatientPhotoStorageService;

  beforeEach(async () => {
    tmpUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'patient-avatar-test-'));
    const originalCwd = process.cwd;
    jest.spyOn(process, 'cwd').mockReturnValue(tmpUploads);

    const config = {
      get: jest.fn().mockReturnValue('http://localhost:4000'),
    } as unknown as ConfigService;

    service = new PatientPhotoStorageService(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpUploads, { recursive: true, force: true });
  });

  async function squareJpegBuffer(size = 600): Promise<Buffer> {
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  async function landscapeJpegBuffer(): Promise<Buffer> {
    return sharp({
      create: {
        width: 800,
        height: 400,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  it('builds absolute public URL', () => {
    expect(service.buildPublicUrl(patientId)).toBe(
      `http://localhost:4000/uploads/patients/${patientId}/avatar.jpg`,
    );
  });

  it('rejects invalid patient UUID', () => {
    expect(() => service.buildPublicUrl('not-a-uuid')).toThrow(
      BadRequestException,
    );
  });

  it('processes square image and saves avatar.jpg', async () => {
    const url = await service.processAndSave(
      patientId,
      await squareJpegBuffer(),
    );

    expect(url).toBe(
      `http://localhost:4000/uploads/patients/${patientId}/avatar.jpg`,
    );

    const filePath = service.avatarFilePath(patientId);
    expect(fs.existsSync(filePath)).toBe(true);

    const meta = await sharp(filePath).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.format).toBe('jpeg');
  });

  it('center-crops non-square images', async () => {
    await service.processAndSave(patientId, await landscapeJpegBuffer());

    const meta = await sharp(service.avatarFilePath(patientId)).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('rejects non-image buffer', async () => {
    await expect(
      service.processAndSave(patientId, Buffer.from('not-an-image')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deleteIfExists removes file and empty directory', async () => {
    await service.processAndSave(patientId, await squareJpegBuffer());
    expect(fs.existsSync(service.avatarFilePath(patientId))).toBe(true);

    service.deleteIfExists(patientId);

    expect(fs.existsSync(service.avatarFilePath(patientId))).toBe(false);
    expect(fs.existsSync(service.avatarDirForPatient(patientId))).toBe(false);
  });

  it('resolveAvatarPath returns path when file exists', async () => {
    await service.processAndSave(patientId, await squareJpegBuffer());

    const resolved = service.resolveAvatarPath(patientId);
    expect(resolved).toBe(service.avatarFilePath(patientId));
  });

  it('resolveAvatarPath returns null when missing', () => {
    expect(service.resolveAvatarPath(patientId)).toBeNull();
  });
});
