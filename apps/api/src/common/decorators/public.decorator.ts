import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as public (no JWT required).
 * The global JwtAuthGuard (feature/auth branch) reads this metadata. Every endpoint
 * WITHOUT @Public() requires authentication by default — secure by default.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
