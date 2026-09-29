import { requireNativeModule } from 'expo-modules-core';

export type SharedItem = {
  id: string;
  text: string;
  createdAt: number;
};

export default requireNativeModule<{
  getItems(): Promise<SharedItem[]>;
}>('LaterShare');
