import { Schema, model } from 'mongoose';
import { TClient, ClientModel } from './client.interface';

const clientSchema = new Schema<TClient, ClientModel>({
  name: { type: String, required: true },
  image: { type: String },
  description: { type: String },
  atcCodes: { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
});

clientSchema.statics.isClientExists = async function (id: string) {
  return await this.findOne({ _id: id, isDeleted: false });
};

export const Client = model<TClient, ClientModel>('Client', clientSchema);
