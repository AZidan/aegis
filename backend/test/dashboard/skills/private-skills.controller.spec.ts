import { Test, TestingModule } from '@nestjs/testing';
import { PrivateSkillsController } from '../../../src/dashboard/skills/private-skills.controller';
import { PrivateSkillsService } from '../../../src/dashboard/skills/private-skills.service';
import { SkillValidatorService } from '../../../src/dashboard/skills/skill-validator.service';

const TENANT_ID = 'tenant-uuid-1';
const USER_ID = 'user-uuid-1';
const SKILL_ID = 'skill-uuid-1';

const mockReq = (overrides = {}) => ({
  tenantId: TENANT_ID,
  user: { id: USER_ID },
  ...overrides,
});

describe('PrivateSkillsController', () => {
  let controller: PrivateSkillsController;
  let service: {
    submitPrivateSkill: jest.Mock;
    listOwnPrivateSkills: jest.Mock;
    updateDraft: jest.Mock;
    getVersions: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      submitPrivateSkill: jest.fn(),
      listOwnPrivateSkills: jest.fn(),
      updateDraft: jest.fn(),
      getVersions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrivateSkillsController],
      providers: [
        { provide: PrivateSkillsService, useValue: service },
        {
          provide: SkillValidatorService,
          useValue: {
            validate: jest
              .fn()
              .mockResolvedValue({ valid: true, issues: [] }),
          },
        },
      ],
    }).compile();

    controller = module.get(PrivateSkillsController);
  });

  it('should call submitPrivateSkill with tenantId and userId', async () => {
    const dto = { name: 'test-skill', version: '1.0.0', description: 'Test skill description', category: 'custom', compatibleRoles: ['engineering'], sourceCode: 'code', permissions: { network: { allowedDomains: [] }, files: { readPaths: [], writePaths: [] }, env: { required: [], optional: [] } } };
    service.submitPrivateSkill.mockResolvedValue({ id: SKILL_ID });

    await controller.submitPrivateSkill(mockReq() as any, dto as any);

    expect(service.submitPrivateSkill).toHaveBeenCalledWith(TENANT_ID, USER_ID, dto);
  });

  it('should call listOwnPrivateSkills with tenantId', async () => {
    service.listOwnPrivateSkills.mockResolvedValue({ data: [] });

    await controller.listOwnPrivateSkills(mockReq() as any);

    expect(service.listOwnPrivateSkills).toHaveBeenCalledWith(TENANT_ID);
  });

  it('should call updateDraft with tenantId, id, userId, and dto', async () => {
    const dto = { description: 'Updated description text' };
    service.updateDraft.mockResolvedValue({ id: SKILL_ID });

    await controller.updateDraft(mockReq() as any, SKILL_ID, dto as any);

    expect(service.updateDraft).toHaveBeenCalledWith(TENANT_ID, SKILL_ID, USER_ID, dto);
  });

  it('should call getVersions with tenantId and id', async () => {
    service.getVersions.mockResolvedValue({ data: [] });

    await controller.getVersions(mockReq() as any, SKILL_ID);

    expect(service.getVersions).toHaveBeenCalledWith(TENANT_ID, SKILL_ID);
  });
});
