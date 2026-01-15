import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsDateString,
  IsArray,
} from 'class-validator';

export class UpdateTaskDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'in_review', 'done', 'blocked'])
  status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';

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
  @IsInt()
  @Min(0)
  actualHours?: number;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  blockedBy?: string;
}
