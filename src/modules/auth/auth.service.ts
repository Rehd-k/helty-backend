import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { StaffService } from '../staff/staff.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly staffService: StaffService,
    private readonly jwtService: JwtService,
  ) { }

  async validateUser(email: string, pass: string) {
    const user = await this.staffService.findByEmail(email);
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
      role: user.role,
      department: user.department?.name || null,
      accountType: user.accountType,
      departmentHead: user.headedDepartment ? true : false,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      staff: user
    };
  }
}
