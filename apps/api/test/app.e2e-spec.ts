import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';

import { Public } from '@common/decorators/public.decorator';

import { AppModule } from '../src/app.module';
import { setupApp, setupSwagger } from '../src/setup-app';

// Test-only endpoint: lets us verify ZodValidationPipe + GlobalExceptionFilter end-to-end
// before any real feature endpoint exists.
class EchoDto extends createZodDto(z.object({ email: z.email(), age: z.number().int() })) {}

@Controller('__test__')
class EchoController {
  @Public()
  @Post('echo')
  echo(@Body() dto: EchoDto): EchoDto {
    return dto;
  }
}

describe('App foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [EchoController],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health → 200 with standard success format', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok', timestamp: expect.any(String) },
    });
  });

  it('GET unknown route → 404 with standard error format', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);

    expect(res.body).toMatchObject({ success: false, statusCode: 404, error: 'NOT_FOUND' });
    expect(res.body).toHaveProperty('timestamp');
  });

  it('POST invalid body → 400 with field-level details', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test__/echo')
      .send({ email: 'not-an-email', age: 'x' })
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      error: 'BAD_REQUEST',
      message: 'Validation failed',
    });
    const fields = (res.body as { details: { field: string }[] }).details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'age']));
  });

  it('GET /api/docs-json → OpenAPI document with the auth endpoints and schemas', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const doc = res.body as {
      paths: Record<string, unknown>;
      components: { schemas: Partial<Record<string, { properties?: Record<string, unknown> }>> };
    }; // OpenAPI JSON shape, only the parts this test reads

    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/register',
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',
        '/api/v1/auth/me',
      ]),
    );
    // Schemas with transform/refine (email normalization, password byte limit) still document
    // their fields
    expect(Object.keys(doc.components.schemas.RegisterDto?.properties ?? {})).toEqual(
      expect.arrayContaining(['email', 'password', 'fullName']),
    );
  });

  it('POST valid body → 201 wrapped in success format', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test__/echo')
      .send({ email: 'a@b.co', age: 30 })
      .expect(201);

    expect(res.body).toEqual({ success: true, data: { email: 'a@b.co', age: 30 } });
  });
});
