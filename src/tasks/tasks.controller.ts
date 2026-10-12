import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/auth.decorators';
import { CreateTaskDto, ListTasksDto, TaskResponseDto, UpdateTaskDto } from './tasks.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('v1/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  @ApiCreatedResponse({ type: TaskResponseDto })
  create(@CurrentUserId() ownerId: string, @Body() body: CreateTaskDto) { return this.tasks.create(ownerId, body); }

  @Get()
  @ApiOkResponse({ type: TaskResponseDto, isArray: true })
  list(@CurrentUserId() ownerId: string, @Query() query: ListTasksDto) { return this.tasks.list(ownerId, query); }

  @Get(':id')
  @ApiOkResponse({ type: TaskResponseDto })
  find(@CurrentUserId() ownerId: string, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.tasks.find(ownerId, id); }

  @Patch(':id')
  @ApiOkResponse({ type: TaskResponseDto })
  update(@CurrentUserId() ownerId: string, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: UpdateTaskDto) {
    return this.tasks.update(ownerId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@CurrentUserId() ownerId: string, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.tasks.remove(ownerId, id); }
}
