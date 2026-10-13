import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === true || value === 'true' || value === '1';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsUrl({ require_tld: false })
  WEB_URL = 'http://localhost:3000';

  @IsUrl({ require_tld: false })
  API_URL = 'http://localhost:4000';

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  JWT_REFRESH_TTL_DAYS = 30;

  @Transform(toBool)
  @IsBoolean()
  COOKIE_SECURE = false;

  @Transform(toBool)
  @IsBoolean()
  RECURRING_SCHEDULER_ENABLED = true;

  @Transform(toBool)
  @IsBoolean()
  SWAGGER_ENABLED = true;

  /** Number of reverse proxies in front of the API (the Next.js server counts as one). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  TRUST_PROXY = 1;

  /**
   * Shared secret for the scheduled-job endpoint. Vercel Cron sends it as
   * `Authorization: Bearer <CRON_SECRET>`. When unset, the endpoint is disabled.
   */
  @IsOptional()
  @IsString()
  @MinLength(16)
  CRON_SECRET?: string;
}

export type AppConfig = EnvironmentVariables;

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const config = plainToInstance(EnvironmentVariables, raw, { exposeDefaultValues: true });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }
  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }
  return config;
}
