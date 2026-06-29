const fs = require('fs');
const path = 'D:/GHOST-WORKER/n8n/workflows/workflow-cs-zalo-v4-datatable.json';
const raw = fs.readFileSync(path, 'utf8');
const wf = JSON.parse(raw);
const d = wf.data || wf;
const nodes = d.nodes;

function findNode(id) { return nodes.find(n => n.id === id); }

// ============================================================
// FIX 1: Parse Booking — add spaId from global staticData
// ============================================================
const parseBooking = findNode('v4-016');
let code = parseBooking.parameters.jsCode;

// Add spaId variable declaration after the existing variable declarations
// The code already has: const thId=input.threadId||'';
// We add spaId right after that
code = code.replace(
  "const thId=input.threadId||'';",
  "const thId=input.threadId||'';\nconst spaId=$getWorkflowStaticData('global').spaId||'default-spa';"
);

// Add spaId to fallback return (isError:true path)
code = code.replace(
  "senderId:sId,senderName:sName,rawAiOutput:ai,threadId:thId,isError:true",
  "senderId:sId,senderName:sName,rawAiOutput:ai,threadId:thId,spaId,isError:true"
);

// Add spaId to main return (isError:false path)
code = code.replace(
  "senderId:sId,senderName:sName,rawAiOutput:ai,threadId:thId,isError:false",
  "senderId:sId,senderName:sName,rawAiOutput:ai,threadId:thId,spaId,isError:false"
);

parseBooking.parameters.jsCode = code;
console.log('FIX 1: Parse Booking — added spaId to both returns');

// ============================================================
// FIX 2: Code - Check Duplicate — handle empty input + timestamps
// ============================================================
const checkDup = findNode('v4-021'); // just for reference
const codeCheckDup = findNode('v4-020');
codeCheckDup.parameters.jsCode = [
  "const ex=$input.all();",
  "const parse=$('Parse Booking').first().json;",
  "const unmask=$('Code - Unmask Reply').first().json;",
  "const now=new Date().toISOString();",
  "if(ex.length===0||!ex[0].json.id){",
  "  return [{json:{...unmask,duplicateAction:'insert',bookingData:parse.bookingData,duplicateReply:'',created_at:now,updated_at:now}}];",
  "}",
  "let action='insert',reply='';",
  "const st=ex[0].json.status||'';",
  "if(st==='Mới đặt'){action='update';reply='Em đã cập nhật lịch! 💖';}",
  "else if(st==='Đã xác nhận'){action='reject';reply='Lịch đã xác nhận! Gọi hotline 📞';}",
  "else if(st==='Hoàn thành'){action='insert';}",
  "return [{json:{...unmask,duplicateAction:action,bookingData:parse.bookingData,duplicateReply:reply,created_at:ex[0].json.created_at||now,updated_at:now}}];"
].join('\n');
console.log('FIX 2: Code - Check Duplicate — empty input + timestamps');

// ============================================================
// FIX 3: DT - Check Duplicate — add matchType
// ============================================================
const dtCheckDup = findNode('v4-019');
dtCheckDup.parameters.filters.matchType = 'all';
console.log('FIX 3: DT - Check Duplicate — added matchType: all');

// ============================================================
// FIX 4: DT - Update Booking — add matchType + full columns
// ============================================================
const dtUpdate = findNode('v4-025');
dtUpdate.parameters.filters.matchType = 'all';
dtUpdate.parameters.columns.value = {
  service: '={{ $json.bookingData.service }}',
  note: '={{ $json.bookingData.note }}',
  status: 'Mới đặt',
  customer_name: '={{ $json.bookingData.name }}',
  updated_at: '={{ new Date().toISOString() }}'
};
console.log('FIX 4: DT - Update Booking — matchType + full columns');

// ============================================================
// FIX 5: DT - Insert Booking — add created_at + updated_at
// ============================================================
const dtInsert = findNode('v4-024');
dtInsert.parameters.columns.value = {
  spa_id: '={{ $json.spaId }}',
  customer_name: '={{ $json.bookingData.name }}',
  customer_phone: '={{ $json.bookingData.phone }}',
  service: '={{ $json.bookingData.service }}',
  note: '={{ $json.bookingData.note }}',
  zalo_id: '={{ $json.senderId }}',
  status: 'Mới đặt',
  created_at: '={{ new Date().toISOString() }}',
  updated_at: '={{ new Date().toISOString() }}'
};
console.log('FIX 5: DT - Insert Booking — added timestamps');

// ============================================================
// FIX 6: Zalo - Trả lời thường — fix threadId expression
// ============================================================
const zaloReply = findNode('v4-034');
zaloReply.parameters.threadId = '{{ $("Zalo Message Trigger").first().json.threadId }}';
console.log('FIX 6: Zalo - Trả lời thường — fixed threadId');

// ============================================================
// SAVE
// ============================================================
fs.writeFileSync(path, JSON.stringify(wf));
console.log('\n=== FILE SAVED ===');

// ============================================================
// VERIFY
// ============================================================
const verify = JSON.parse(fs.readFileSync(path, 'utf8'));
const vn = (verify.data || verify).nodes;

const vParse = vn.find(n => n.id === 'v4-016').parameters.jsCode;
const vCheckDup = vn.find(n => n.id === 'v4-020').parameters.jsCode;
const vDtCheckDup = vn.find(n => n.id === 'v4-019').parameters.filters;
const vDtUpdate = vn.find(n => n.id === 'v4-025').parameters;
const vDtInsert = vn.find(n => n.id === 'v4-024').parameters.columns.value;
const vZaloReply = vn.find(n => n.id === 'v4-034').parameters.threadId;

console.log('\n--- VERIFICATION ---');
console.log('Parse Booking has spaId var:', vParse.includes("getWorkflowStaticData('global').spaId"));
console.log('Parse Booking spaId in fallback:', vParse.includes('spaId,isError:true'));
console.log('Parse Booking spaId in main:', vParse.includes('spaId,isError:false'));
console.log('Check Duplicate handles empty:', vCheckDup.includes('ex.length===0'));
console.log('Check Duplicate has created_at:', vCheckDup.includes('created_at:now'));
console.log('DT Check Dup matchType:', vDtCheckDup.matchType);
console.log('DT Update matchType:', vDtUpdate.filters.matchType);
console.log('DT Update has customer_name:', 'customer_name' in vDtUpdate.columns.value);
console.log('DT Update has updated_at:', 'updated_at' in vDtUpdate.columns.value);
console.log('DT Insert has created_at:', 'created_at' in vDtInsert);
console.log('DT Insert has updated_at:', 'updated_at' in vDtInsert);
console.log('Zalo Reply threadId fixed:', !vZaloReply.includes('{{ $json.threadId }}'));
