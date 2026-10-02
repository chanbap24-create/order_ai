// pdf.js 정적 자산(워커·한글 CMap·표준 폰트)을 public/pdfjs로 복사 — postinstall에서 실행.
// 설치된 pdfjs-dist 버전과 항상 일치시키기 위해 커밋하지 않고 설치 시 생성한다(.gitignore).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pdfjs-dist/package.json'));
const out = join(process.cwd(), 'public', 'pdfjs');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'legacy', 'build', 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'));
cpSync(join(root, 'cmaps'), join(out, 'cmaps'), { recursive: true });
cpSync(join(root, 'standard_fonts'), join(out, 'standard_fonts'), { recursive: true });
console.log('[pdfjs] assets copied → public/pdfjs');
