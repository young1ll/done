import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsEnum(['epic', 'story', 'task', 'bug', 'subtask'])
  type?: 'epic' | 'story' | 'task' | 'bug' | 'subtask';

  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority?: 'critical' | 'high' | 'medium' | 'low';

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatePoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimateHours?: number;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
