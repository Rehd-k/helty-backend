import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { StaffService } from '../staff/staff.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly staffService: StaffService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string) {
    const user = await this.staffService.findByEmailOrPhone(identifier);
    if (user && user.password) {
      const match = await bcrypt.compare(pass, user.password);
      if (match) {
        // strip password before returning
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      staffId: user.staffId,
      accountType: user.accountType,
      staffRole: user.staffRole,
      department: user.department?.name || null,
      departmentHead: user.headedDepartment ? true : false,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      staff: user,
    };
  }
}
