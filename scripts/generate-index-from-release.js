const https = require('https');
const fs = require('fs');

/**
 * GitHub Release의 모든 파일을 가져와서 
 * tasting-notes-index.json을 자동 생성
 * 
 * 사용법:
 * node generate-index-from-release.js
 */

const REPO_OWNER = 'chanbap24-create';
const REPO_NAME = 'order_ai';
const RELEASE_TAG = 'note';

console.log('📥 Fetching release assets from GitHub...\n');

const options = {
  hostname: 'api.github.com',
  path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${RELEASE_TAG}`,
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js',
    'Accept': 'application/vnd.github.v3+json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('❌ Failed to fetch release:', res.statusCode);
      console.error(data);
      process.exit(1);
    }

    const release = JSON.parse(data);
    const assets = release.assets || [];
    
    console.log(`✅ Found ${assets.length} files in release\n`);

    const notes = {};
    let pdfCount = 0;
    let pptxCount = 0;

    assets.forEach((asset) => {
      const filename = asset.name;
      
      // PDF 파일만 처리
      if (filename.toLowerCase().endsWith('.pdf')) {
        const itemNo = filename.replace('.pdf', '');
        const sizeKb = Math.round(asset.size / 1024);
        
        notes[itemNo] = {
          exists: true,
          filename: filename,
          size_kb: sizeKb,
          pages: 1, // 기본값
          wine_name: "" // 나중에 수동으로 채울 수 있음
        };
        
        pdfCount++;
        
        if (pdfCount % 20 === 0) {
          console.log(`✅ Processed ${pdfCount} PDF files...`);
        }
      } else if (filename.toLowerCase().endsWith('.pptx')) {
        pptxCount++;
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`  - PDF files: ${pdfCount}`);
    console.log(`  - PPTX files: ${pptxCount}`);
    console.log(`  - Other files: ${assets.length - pdfCount - pptxCount}`);

    const index = {
      version: "1.0",
      updated_at: new Date().toISOString().split('T')[0],
      base_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}`,
      notes: notes
    };

    const outputPath = './tasting-notes-index.json';
    fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf8');

    console.log(`\n✅ Generated: ${outputPath}`);
    console.log(`📊 Total items in index: ${Object.keys(notes).length}`);
    console.log(`\n📝 Next steps:`);
    console.log(`1. Review tasting-notes-index.json`);
    console.log(`2. Upload to GitHub Release: ${RELEASE_TAG}`);
    console.log(`3. Test the app!`);
    
    // 처음 5개 항목 미리보기
    console.log(`\n🔍 Preview (first 5 items):`);
    Object.keys(notes).slice(0, 5).forEach((itemNo) => {
      console.log(`  - ${itemNo}: ${notes[itemNo].filename} (${notes[itemNo].size_kb} KB)`);
    });
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

req.end();
