import '@types/jest';

declare global {
    const jest: typeof import('@jest/globals').jest;
    const describe: typeof import('@jest/globals').describe;
    const expect: typeof import('@jest/globals').expect;
    const test: typeof import('@jest/globals').test;
    const beforeEach: typeof import('@jest/globals').beforeEach;
    const afterEach: typeof import('@jest/globals').afterEach;
    const beforeAll: typeof import('@jest/globals').beforeAll;
    const afterAll: typeof import('@jest/globals').afterAll;
}
