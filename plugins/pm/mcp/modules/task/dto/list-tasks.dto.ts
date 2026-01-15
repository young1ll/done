import { IsUUID, IsEnum, IsOptional, IsInt, Min } from 'class-validator';

export class ListTasksDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'in_review', 'done', 'blocked'])
  status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';

  @IsOptional()
  @IsEnum(['epic', 'story', 'task', 'bug', 'subtask'])
  type?: 'epic' | 'story' | 'task' | 'bug' | 'subtask';

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
