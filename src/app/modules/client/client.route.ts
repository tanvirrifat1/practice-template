import express from 'express';
import { ClientControllers } from './client.controller';
import validateRequest from '../../middlewares/validateRequest';
import { createClientValidationSchema, updateClientValidationSchema } from './client.validation';

const router = express.Router();

router.post(
  '/create-client',
  validateRequest(createClientValidationSchema),
  ClientControllers.createClient,
);

router.get(
  '/:id',
  ClientControllers.getSingleClient,
);

router.patch(
  '/:id',
  validateRequest(updateClientValidationSchema),
  ClientControllers.updateClient,
);

router.delete(
  '/:id',
  ClientControllers.deleteClient,
);

router.get(
  '/',
  ClientControllers.getAllClients,
);

export const ClientRoutes = router;
