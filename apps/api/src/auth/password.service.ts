import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const COST = 12;

@Injectable()
export class PasswordService {
  // Pre-computed hash used to keep login timing similar when the email does not exist.
  private readonly dummyHash = bcrypt.hashSync('timing-equaliser-not-a-real-password', COST);

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, COST);
  }

  verify(password: string, hash: string | null | undefined): Promise<boolean> {
    return bcrypt.compare(password, hash ?? this.dummyHash);
  }
}
