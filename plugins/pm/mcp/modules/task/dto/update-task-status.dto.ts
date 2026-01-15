import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsUUID()
  id!: string;

  @IsEnum(['todo', 'in_progress', 'in_review', 'done', 'blocked'])
  status!: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';

  @IsOptional()
  @IsString()
  reason?: string;
}
