// 테스트 전용 expo-secure-store 대체. jest.mock factory에서 requireActual로 사용한다.
const store = new Map<string, string>();

export const secureStoreMock = {
  store,
  setItemAsync: jest.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    store.delete(key);
  }),
};
