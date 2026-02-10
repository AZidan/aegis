import { Test, TestingModule } from '@nestjs/testing';
import { AdminSkillsReviewController } from '../../../src/admin/skills/admin-skills-review.controller';
import { AdminSkillsReviewService } from '../../../src/admin/skills/admin-skills-review.service';

const SKILL_ID = 'skill-uuid-1';
const ADMIN_ID = 'admin-uuid-1';

const mockAdminUser = () => ({
  id: ADMIN_ID,
  role: 'platform_admin',
});

describe('AdminSkillsReviewController', () => {
  let controller: AdminSkillsReviewController;
  let service: {
    listReviewQueue: jest.Mock;
    approveSkill: jest.Mock;
    rejectSkill: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      listReviewQueue: jest.fn(),
      approveSkill: jest.fn(),
      rejectSkill: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSkillsReviewController],
      providers: [
        { provide: AdminSkillsReviewService, useValue: service },
      ],
    }).compile();

    controller = module.get(AdminSkillsReviewController);
  });

  it('should call listReviewQueue', async () => {
    service.listReviewQueue.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.listReviewQueue(mockAdminUser());

    expect(service.listReviewQueue).toHaveBeenCalled();
    expect(result.total).toBe(0);
  });

  it('should call approveSkill with skillId and reviewerId', async () => {
    service.approveSkill.mockResolvedValue({ id: SKILL_ID, status: 'approved' });

    await controller.approveSkill(SKILL_ID, mockAdminUser());

    expect(service.approveSkill).toHaveBeenCalledWith(SKILL_ID, ADMIN_ID);
  });

  it('should call rejectSkill with skillId, reviewerId, and reason', async () => {
    service.rejectSkill.mockResolvedValue({ id: SKILL_ID, status: 'rejected' });

    await controller.rejectSkill(SKILL_ID, 'Security issue', mockAdminUser());

    expect(service.rejectSkill).toHaveBeenCalledWith(SKILL_ID, ADMIN_ID, 'Security issue');
  });

  it('should default to "No reason provided" when reason is empty', async () => {
    service.rejectSkill.mockResolvedValue({ id: SKILL_ID, status: 'rejected' });

    await controller.rejectSkill(SKILL_ID, '', mockAdminUser());

    expect(service.rejectSkill).toHaveBeenCalledWith(SKILL_ID, ADMIN_ID, 'No reason provided');
  });
});
