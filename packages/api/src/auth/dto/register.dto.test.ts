import { validate } from 'class-validator';

import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new RegisterDto();
    dto.email = 'test@example.com';
    dto.password = 'MyP@ssw0rd1';
    dto.name = 'Test User';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation with invalid email', async () => {
    const dto = new RegisterDto();
    dto.email = 'invalid-email';
    dto.password = 'MyP@ssw0rd1';
    dto.name = 'Test User';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('should fail validation with missing password', async () => {
    const dto = new RegisterDto();
    dto.email = 'test@example.com';
    dto.name = 'Test User';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError).toBeDefined();
  });

  it('should fail validation with missing name', async () => {
    const dto = new RegisterDto();
    dto.email = 'test@example.com';
    dto.password = 'MyP@ssw0rd1';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const nameError = errors.find((e) => e.property === 'name');
    expect(nameError).toBeDefined();
  });

  it('should fail validation with short name', async () => {
    const dto = new RegisterDto();
    dto.email = 'test@example.com';
    dto.password = 'MyP@ssw0rd1';
    dto.name = 'A';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const nameError = errors.find((e) => e.property === 'name');
    expect(nameError).toBeDefined();
  });
});
