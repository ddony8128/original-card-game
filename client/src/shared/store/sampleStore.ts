// 아래는 zustand 샘플 코드입니다. 참고용으로만 보관합니다.
// 실제 프로젝트에서는 React Query와 라우팅 상태를 우선 사용하세요.
//
// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
//
// interface SampleState {
//   value: number;
//   setValue: (n: number) => void;
//   reset: () => void;
// }
//
// export const useSampleStore = create<SampleState>()(
//   persist(
//     (set) => ({
//       value: 0,
//       setValue: (n) => set({ value: n }),
//       reset: () => set({ value: 0 }),
//     }),
//     { name: 'sample-store' }
//   )
// );

