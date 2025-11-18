import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 서버는 TS 소스 기준으로만 테스트 실행
    include: ['src/**/*.test.ts', 'src/core/test/*.test.ts'],
    exclude: ['dist/**', 'coverage/**'],
  },
});
