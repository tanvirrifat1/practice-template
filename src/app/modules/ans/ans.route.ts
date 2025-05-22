import express from 'express';
import { AnsController } from './ans.controller';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';

const router = express.Router();

router.post('/create', auth(USER_ROLES.USER), AnsController.createChat);

export const ansRoute = router;
