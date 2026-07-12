import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const AVATAR_FILENAME = 'avatar.jpg';
const AVATAR_SIZE = 512;
const SQUARE_TOLERANCE = 0.02;
const JPEG_QUALITY = 85;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uploadBase(): string {
  return path.join(process.cwd(), 'uploads', 'patients');
}

@Injectable()
export class PatientPhotoStorageService {
  constructor(private readonly config: ConfigService) {}

  assertValidPatientUuid(patientId: string): void {
    if (!UUID_RE.test(patientId)) {
      throw new BadRequestException('Invalid patient id');
    }
  }

  avatarDirForPatient(patientId: string): string {
    this.assertValidPatientUuid(patientId);
    return path.join(uploadBase(), patientId);
  }

  avatarFilePath(patientId: string): string {
    return path.join(this.avatarDirForPatient(patientId), AVATAR_FILENAME);
  }

  buildPublicUrl(patientId: string): string {
    this.assertValidPatientUuid(patientId);
    const base =
      this.config.get<string>('PUBLIC_API_BASE_URL')?.replace(/\/$/, '') ?? '';
    return `${base}/uploads/patients/${patientId}/${AVATAR_FILENAME}`;
  }

  async processAndSave(patientId: string, buffer: Buffer): Promise<string> {
    this.assertValidPatientUuid(patientId);

    let image: sharp.Sharp;
    try {
      image = sharp(buffer, { failOn: 'none' });
      await image.metadata();
    } catch {
      throw new BadRequestException('Invalid image file');
    }

    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('Invalid image dimensions');
    }

    const ratio = metadata.width / metadata.height;
    const isSquare =
      ratio >= 1 - SQUARE_TOLERANCE && ratio <= 1 + SQUARE_TOLERANCE;

    let pipeline = sharp(buffer).rotate();

    if (!isSquare) {
      const size = Math.min(metadata.width, metadata.height);
      const left = Math.floor((metadata.width - size) / 2);
      const top = Math.floor((metadata.height - size) / 2);
      pipeline = pipeline.extract({ left, top, width: size, height: size });
    }

    const processed = await pipeline
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const dir = this.avatarDirForPatient(patientId);
    fs.mkdirSync(dir, { recursive: true });

    const filePath = this.avatarFilePath(patientId);
    try {
      fs.writeFileSync(filePath, processed);
    } catch {
      throw new InternalServerErrorException('Failed to store profile photo');
    }

    return this.buildPublicUrl(patientId);
  }

  deleteIfExists(patientId: string): void {
    this.assertValidPatientUuid(patientId);
    const filePath = this.avatarFilePath(patientId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const dir = this.avatarDirForPatient(patientId);
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
      }
    }
  }

  resolveAvatarPath(patientId: string): string | null {
    this.assertValidPatientUuid(patientId);
    const filePath = this.avatarFilePath(patientId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const resolved = path.resolve(filePath);
    const baseResolved = path.resolve(uploadBase());
    if (!resolved.startsWith(baseResolved)) {
      return null;
    }
    return resolved;
  }
}
