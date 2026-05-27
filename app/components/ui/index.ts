// 기존 default export 컴포넌트는 각 파일에서 직접 import (back-compat 유지)
//   import Button from '@/app/components/ui/Button';
//   import Card from '@/app/components/ui/Card';
// 새 named export 컴포넌트는 여기 통합:
export { PageHeader } from './PageHeader';
export { Stack } from './Stack';
export { Section } from './Section';
