import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../dto/auth.dto'; // Import Enum Role từ file DTO của bạn

// Key này dùng để Guard tìm kiếm metadata (đừng đổi tên nó)
export const ROLES_KEY = 'roles';

// Decorator nhận vào danh sách các Role (VD: admin, sale...)
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
