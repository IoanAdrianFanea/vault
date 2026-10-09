/*
HTTP endpoints for projects: any signed-in user can list the projects they
can see, and admins can create, rename and delete projects and manage their
members.
*/


import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/CreateProject.dto';
import { UpdateProjectDto } from './dto/UpdateProject.dto';
import { Param, Body } from '@nestjs/common';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async listProjects(
    @Request() req,
    @Query('scope') scope?: 'all' | 'uploadable',
  ) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    return this.projectsService.listProjects(userId, scope);
  }

  @Post()
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
    @Request() req,
  ) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.projectsService.createProject(createProjectDto);
  }

  @Patch(':id')
  async updateProjectName(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Request() req,
  ) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.projectsService.updateProjectName(id, updateProjectDto);
  }

  @Delete(':id')
  async deleteProject(@Param('id') id: string, @Request() req) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    const userId = req.user?.id || req.user?.sub;
    return this.projectsService.deleteProject(id, userId);
  }

  @Get(':id/members')
  async getProjectMembers(@Param('id') id: string, @Request() req) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.projectsService.getProjectMembers(id);
  }

  @Post(':id/members')
  async addProjectMember(
    @Param('id') id: string,
    @Body() { userId }: { userId: string },
    @Request() req,
  ) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.projectsService.addProjectMember(id, userId);
  }

  @Delete(':id/members/:userId')
  async removeProjectMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.projectsService.removeProjectMember(id, userId);
  }

  @Get(':id')
  async getProject(@Param('id') id: string, @Request() req) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.projectsService.getProject(id);
  }
}
