import { Model } from 'mongoose';

export type TClient = {
  name: string;
  description?: string;
  atcCodes: string;
  isDeleted: boolean;
  image: string;
};

export interface ClientModel extends Model<TClient> {
  isClientExists(id: string): Promise<TClient | null>;
}
