import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { CreateTaskDto, ListTasksDto, TaskResponseDto, UpdateTaskDto } from './tasks.dto';

interface TaskRow {
  id: string; title: string; description: string; completed: boolean; created_at: Date; updated_at: Date;
}
function publicTask(task: TaskRow): TaskResponseDto {
  return { id: task.id, title: task.title, description: task.description, completed: task.completed,
    createdAt: task.created_at.toISOString(), updatedAt: task.updated_at.toISOString() };
}

@Injectable()
export class TasksService {
  constructor(private readonly database: DatabaseService) {}

  async create(ownerId: string, body: CreateTaskDto) {
    const { rows } = await this.database.query<TaskRow>(
      'INSERT INTO tasks (id, owner_id, title, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [randomUUID(), ownerId, body.title, body.description ?? ''],
    );
    return publicTask(rows[0]!);
  }

  async list(ownerId: string, query: ListTasksDto) {
    const { rows } = await this.database.query<TaskRow>(
      'SELECT * FROM tasks WHERE owner_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3',
      [ownerId, query.limit, query.offset],
    );
    return rows.map(publicTask);
  }

  async find(ownerId: string, id: string) {
    const { rows } = await this.database.query<TaskRow>('SELECT * FROM tasks WHERE id = $1 AND owner_id = $2', [id, ownerId]);
    if (!rows[0]) throw new NotFoundException('Task not found');
    return publicTask(rows[0]);
  }

  async update(ownerId: string, id: string, body: UpdateTaskDto) {
    if (body.title === undefined && body.description === undefined && body.completed === undefined) {
      throw new BadRequestException('At least one task field is required');
    }
    const { rows } = await this.database.query<TaskRow>(
      `UPDATE tasks SET title = COALESCE($3, title), description = COALESCE($4, description),
        completed = COALESCE($5, completed), updated_at = now()
        WHERE id = $1 AND owner_id = $2 RETURNING *`,
      [id, ownerId, body.title, body.description, body.completed],
    );
    if (!rows[0]) throw new NotFoundException('Task not found');
    return publicTask(rows[0]);
  }

  async remove(ownerId: string, id: string) {
    const { rowCount } = await this.database.query('DELETE FROM tasks WHERE id = $1 AND owner_id = $2', [id, ownerId]);
    if (rowCount !== 1) throw new NotFoundException('Task not found');
  }
}
