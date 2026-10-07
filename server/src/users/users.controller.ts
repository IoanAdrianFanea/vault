import { CreateUserDto } from './dto/CreateUser.dto';
import { SetUserDto } from './dto/SetUser.dto';
import { UpdateAccountStatusDto } from './dto/UpdateAccountStatus.dto';
import { AdminEditUserDto } from './dto/AdminEditUser.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  Controller,
  UseGuards,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Request,
  Query,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // retrieve all users - ADMIN ONLY
  @Get()
  async getUsers(@Request() req) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }

    return this.usersService.findAll();
  }

  // update user role - ADMIN ONLY
  @Post(':id/role')
  async setUserRole(
    @Param('id') id: string,
    @Body() setUserDto: SetUserDto,
    @Request() req,
  ) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.usersService.setUserRole(req.user.id, id, setUserDto);
  }

  // edit user profile (name, email, password) - ADMIN ONLY
  @Patch(':id')
  async adminEditUser(
    @Param('id') id: string,
    @Body() dto: AdminEditUserDto,
    @Request() req,
  ) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this resource');
    }
    return this.usersService.adminEditUser(id, dto);
  }

  // create new user - ADMIN ONLY
  @Post()
  async createUser(@Body() createUserDto: CreateUserDto, @Request() req) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.usersService.createUser(createUserDto);
  }

  // search users by name or email - ADMIN ONLY
  @Get('search')
  async searchUsers(@Query('q') q: string, @Request() req) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    return this.usersService.searchUsers(q ?? '');
  }

  // retrieve all pending users - ADMIN ONLY
  @Get('pending')
  async getPendingUsers(@Request() req) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this resource');
    }
    return this.usersService.findByAccountStatus('PENDING');
  }

  // retrieve all rejected users - ADMIN ONLY
  @Get('rejected')
  async getRejectedUsers(@Request() req) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this resource');
    }
    return this.usersService.findByAccountStatus('REJECTED');
  }

  // update account status (approve/reject) - ADMIN ONLY
  @Patch(':id/status')
  async updateAccountStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAccountStatusDto,
    @Request() req,
  ) {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this resource');
    }
    return this.usersService.updateAccountStatus(req.user.id, id, dto.status);
  }

  // delete user by ID - ADMIN ONLY
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string, @Request() req) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can access this resource');
    }
    await this.usersService.deleteUser(req.user.id, id);
  }

  // retrieve user by ID - ALL
  @Get(':id')
  async getUserById(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN' && userId !== id) {
      throw new ForbiddenException('You can only access your own profile');
    }

    return this.usersService.findByIdSafe(id);
  }
}
