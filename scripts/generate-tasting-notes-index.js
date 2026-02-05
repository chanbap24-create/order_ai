const fs = require('fs');
const path = require('path');

/**
 * PDF 파일들이 있는 폴더를 스캔해서 
 * tasting-notes-index.json을 자동 생성
 * 
 * 사용법:
 * 1. PDF 파일들을 한 폴더에 모두 넣기
 *    예: /path/to/tasting-notes/
 *        3422501.pdf
 *        3422004.pdf
 *        ...
 * 
 * 2. 이 스크립트 실행:
 *    node generate-tasting-notes-index.js /path/to/tasting-notes/
 * 
 * 3. tasting-notes-index.json 생성됨!
 */

const folderPath = process.argv[2] || '.';

console.log(`📂 Scanning folder: ${folderPath}\n`);

if (!fs.existsSync(folderPath)) {
  console.error('❌ Folder not found!');
  process.exit(1);
}

const files = fs.readdirSync(folderPath);
const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

console.log(`📄 Found ${pdfFiles.length} PDF files\n`);

const notes = {};

pdfFiles.forEach((filename, index) => {
  const itemNo = path.basename(filename, '.pdf');
  const filePath = path.join(folderPath, filename);
  const stats = fs.statSync(filePath);
  const sizeKb = Math.round(stats.size / 1024);
  
  notes[itemNo] = {
    exists: true,
    filename: filename,
    size_kb: sizeKb,
    pages: 0, // PDF 페이지 수는 수동으로 입력 필요
    wine_name: "" // 와인명은 수동으로 입력 필요
  };
  
  if ((index + 1) % 50 === 0) {
    console.log(`✅ Processed ${index + 1}/${pdfFiles.length} files...`);
  }
});

const index = {
  version: "1.0",
  updated_at: new Date().toISOString().split('T')[0],
  base_url: "https://github.com/chanbap24-create/order_ai/releases/download/v1.0",
  notes: notes
};

const outputPath = path.join(folderPath, 'tasting-notes-index.json');
fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf8');

console.log(`\n✅ Generated: ${outputPath}`);
console.log(`📊 Total items: ${Object.keys(notes).length}`);
console.log(`\n📝 Next steps:`);
console.log(`1. Edit tasting-notes-index.json to add wine_name for each item`);
console.log(`2. Upload tasting-notes-index.json to GitHub Release`);
console.log(`3. Upload all PDF files to GitHub Release`);
console.log(`4. Update GITHUB_RELEASE_URL in /app/api/tasting-notes/route.ts`);
