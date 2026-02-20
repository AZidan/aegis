import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SkillPackageController } from '../skill-package.controller';
import { SkillPackageService } from '../skill-package.service';
import { PackageValidationResult } from '../interfaces/skill-package.interface';

describe('SkillPackageController', () => {
  let controller: SkillPackageController;
  let serviceMock: jest.Mocked<SkillPackageService>;

  const mockValidResult: PackageValidationResult = {
    valid: true,
    packageId: 'pkg-123',
    manifest: { name: 'test-skill', version: '1.0.0' },
    skillMd: {
      title: 'Test',
      description: 'Test skill',
      steps: [],
      rawContent: '# Test',
      frontmatter: {},
    },
    files: [
      { path: 'skill.md', size: 100, type: 'skill-definition' },
      { path: 'manifest.json', size: 200, type: 'manifest' },
    ],
    issues: [],
  };

  const mockValidateOnlyResult: PackageValidationResult = {
    ...mockValidResult,
    packageId: undefined,
  };

  beforeEach(async () => {
    serviceMock = {
      parseAndValidate: jest.fn(),
      getStoredPackage: jest.fn(),
      removeStoredPackage: jest.fn(),
    } as unknown as jest.Mocked<SkillPackageService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkillPackageController],
      providers: [
        { provide: SkillPackageService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<SkillPackageController>(SkillPackageController);
  });

  describe('upload', () => {
    it('should return 201 with packageId on successful upload', async () => {
      serviceMock.parseAndValidate.mockResolvedValue(mockValidResult);

      const file = {
        buffer: Buffer.from('fake-zip'),
        originalname: 'skill.zip',
        mimetype: 'application/zip',
      } as any;

      const req = {
        tenantId: 'tenant-1',
        user: { sub: 'user-1' },
      } as any;

      const result = await controller.upload(file, req);

      expect(result.valid).toBe(true);
      expect(result.packageId).toBe('pkg-123');
      expect(serviceMock.parseAndValidate).toHaveBeenCalledWith(
        file.buffer,
        { store: true, tenantId: 'tenant-1', userId: 'user-1' },
      );
    });

    it('should throw BadRequestException when no file is uploaded', async () => {
      const req = {
        tenantId: 'tenant-1',
        user: { sub: 'user-1' },
      } as any;

      await expect(
        controller.upload(undefined as any, req),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validate', () => {
    it('should return 200 without packageId on validation-only', async () => {
      serviceMock.parseAndValidate.mockResolvedValue(mockValidateOnlyResult);

      const file = {
        buffer: Buffer.from('fake-zip'),
        originalname: 'skill.zip',
        mimetype: 'application/zip',
      } as any;

      const result = await controller.validate(file);

      expect(result.valid).toBe(true);
      expect(result.packageId).toBeUndefined();
      expect(serviceMock.parseAndValidate).toHaveBeenCalledWith(file.buffer);
    });

    it('should throw BadRequestException when no file is uploaded', async () => {
      await expect(
        controller.validate(undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
