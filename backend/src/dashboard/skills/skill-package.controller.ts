import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SkillPackageService } from './skill-package.service';
import { PackageValidationResult } from './interfaces/skill-package.interface';

/** Minimal multer file type to avoid @types/multer dependency */
interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  fieldname: string;
}

@Controller('dashboard/skills/package')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SkillPackageController {
  constructor(private readonly skillPackageService: SkillPackageService) {}

  /**
   * POST /api/dashboard/skills/package/upload
   * Upload a skill package ZIP, validate it, and store for later use.
   * Returns validation result with packageId on success.
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: MulterFile,
    @Req() req: Request,
  ): Promise<PackageValidationResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded. Use field name "file".');
    }

    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);

    return this.skillPackageService.parseAndValidate(file.buffer, {
      store: true,
      tenantId,
      userId,
    });
  }

  /**
   * POST /api/dashboard/skills/package/validate
   * Validate a skill package ZIP without storing.
   * Returns validation result without packageId.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async validate(
    @UploadedFile() file: MulterFile,
  ): Promise<PackageValidationResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded. Use field name "file".');
    }

    return this.skillPackageService.parseAndValidate(file.buffer);
  }

  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  private getUserId(req: Request): string {
    return (req as Request & { user: { id: string } }).user.id;
  }
}
