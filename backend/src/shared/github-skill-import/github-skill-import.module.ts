import { Module } from '@nestjs/common';
import { GitHubSkillImportService } from './github-skill-import.service';

@Module({
  providers: [GitHubSkillImportService],
  exports: [GitHubSkillImportService],
})
export class GitHubSkillImportModule {}
