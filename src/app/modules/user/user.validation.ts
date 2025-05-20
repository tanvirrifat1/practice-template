import { z } from 'zod';

const createUserZodSchema = z.object({
  name: z.string({ required_error: 'First name is required' }),
  email: z.string({ required_error: 'Email name is required' }),
  phone: z.string({ required_error: 'Phone name is required' }),
  password: z.string({ required_error: 'Password is required' }),
});

const updateZodSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  postCode: z.string().optional(),
  country: z.string().optional(),
});

export const UserValidation = {
  createUserZodSchema,
  updateZodSchema,
};
