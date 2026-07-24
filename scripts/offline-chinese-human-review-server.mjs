#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_PACKET_PATH = resolve(ROOT, 'audits/offline-chinese-coverage/20260723/human-approval-packet.json');
const ALLOWED_DECISIONS = new Set(['approve', 'revise', 'reject']);

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function summarizePacket(packet) {
  const items = Array.isArray(packet?.items) ? packet.items : [];
  const count = decision => items.filter(item => item.humanDecision === decision).length;
  return {
    total: items.length,
    awaiting: items.filter(item => !item.humanDecision).length,
    approved: count('approve'),
    revised: count('revise'),
    rejected: count('reject'),
    blocked: Array.isArray(packet?.blockedItems) ? packet.blockedItems.length : 0,
    completed: items.length > 0 && items.every(item => Boolean(item.humanDecision))
  };
}

export function applyHumanDecision(packet, payload, now = new Date().toISOString()) {
  if (!packet || !Array.isArray(packet.items)) throw new Error('人工复核包格式无效。');
  const queueId = clean(payload?.queueId);
  const decision = clean(payload?.humanDecision);
  const reviewer = clean(payload?.humanReviewer);
  const approvedChineseInput = clean(payload?.approvedChinese);
  const notes = clean(payload?.humanNotes);

  if (!queueId) throw new Error('缺少 queueId。');
  if (!ALLOWED_DECISIONS.has(decision)) throw new Error('人工决定必须是 approve、revise 或 reject。');
  if (!reviewer) throw new Error('请填写审核人姓名。');

  const item = packet.items.find(candidate => candidate.queueId === queueId);
  if (!item) throw new Error(`找不到审核项目：${queueId}`);

  if (decision === 'revise' && !approvedChineseInput) throw new Error('修改后通过必须填写修改后的中文释义。');
  if (decision === 'revise' && !notes) throw new Error('修改后通过必须填写修改理由。');
  if (decision === 'reject' && !notes) throw new Error('拒绝必须填写理由。');

  item.humanDecision = decision;
  item.humanReviewer = reviewer;
  item.humanReviewedAt = now;
  item.humanNotes = notes || null;
  item.approvedChinese = decision === 'reject'
    ? null
    : (approvedChineseInput || item.candidateChinese);

  packet.summary = {
    ...(packet.summary || {}),
    awaitingHumanReview: summarizePacket(packet).awaiting,
    approved: summarizePacket(packet).approved,
    revised: summarizePacket(packet).revised,
    rejected: summarizePacket(packet).rejected,
    completed: summarizePacket(packet).completed
  };
  return item;
}

async function readPacket(packetPath) {
  return JSON.parse(await readFile(packetPath, 'utf8'));
}

async function writePacketAtomic(packetPath, packet) {
  const tempPath = `${packetPath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(packet, null, 2)}\n`);
  await rename(tempPath, packetPath);
}

function jsonResponse(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  });
  response.end(payload);
}

function htmlResponse(response, html) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store'
  });
  response.end(html);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('请求内容过大。');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const REVIEW_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yomeru 中文词库人工审核</title>
<style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2937;background:#f5f6f8}*{box-sizing:border-box}body{margin:0}.shell{max-width:980px;margin:0 auto;padding:28px 20px 60px}.top{display:flex;gap:20px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}.title{margin:0;font-size:28px}.sub{margin:8px 0;color:#667085}.panel{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:20px;box-shadow:0 8px 24px rgba(16,24,40,.06);margin-top:18px}.progress-track{height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden}.progress-bar{height:100%;background:#111827;width:0;transition:width .2s}.stats{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:14px}.badge{padding:5px 9px;background:#f2f4f7;border-radius:999px}.controls{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:end}.field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}.field input,.field textarea,.field select{width:100%;border:1px solid #d0d5dd;border-radius:10px;padding:10px 12px;font:inherit;background:#fff}.field textarea{min-height:92px;resize:vertical}.nav{display:flex;gap:8px}.nav button,.action{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}.nav button{background:#eef0f3}.nav button:disabled{opacity:.45;cursor:not-allowed}.word{font-size:38px;font-weight:800;margin:0}.reading{font-size:18px;color:#667085;margin:4px 0 0}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.candidate{font-size:22px;font-weight:700;padding:14px;background:#f9fafb;border-radius:12px}.evidence{margin:12px 0;padding-left:20px;color:#475467}.notes{white-space:pre-wrap;color:#475467;line-height:1.65}.actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:16px}.approve{background:#067647;color:#fff}.revise{background:#175cd3;color:#fff}.reject{background:#b42318;color:#fff}.status{min-height:24px;margin-top:12px;font-weight:600}.ok{color:#067647}.error{color:#b42318}.decision{font-weight:800}.empty{text-align:center;padding:50px 10px}.small{font-size:13px;color:#667085}@media(max-width:720px){.controls{grid-template-columns:1fr}.actions{grid-template-columns:1fr}.word{font-size:32px}}
</style>
</head>
<body>
<div class="shell">
  <div class="top"><div><h1 class="title">Yomeru 中文词库人工审核</h1><p class="sub">逐条确认中文释义。每次点击都会立即写回本地复核包。</p></div><div class="small">不会自动批准任何词条</div></div>
  <section class="panel">
    <div class="progress-track"><div id="progressBar" class="progress-bar"></div></div>
    <div id="stats" class="stats"></div>
  </section>
  <section class="panel controls">
    <div class="field"><label for="reviewer">审核人姓名</label><input id="reviewer" placeholder="例如：周若琪"></div>
    <div class="field"><label for="filter">显示范围</label><select id="filter"><option value="awaiting">只看待审核</option><option value="all">全部</option><option value="approve">已通过</option><option value="revise">修改后通过</option><option value="reject">已拒绝</option></select></div>
    <div class="nav"><button id="prev">上一条</button><button id="next">下一条</button></div>
  </section>
  <section id="card" class="panel"></section>
</div>
<script>
let packet=null;let visible=[];let index=0;
const el=id=>document.getElementById(id);
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function summary(){const items=packet.items||[];const count=d=>items.filter(x=>x.humanDecision===d).length;const awaiting=items.filter(x=>!x.humanDecision).length;return{total:items.length,awaiting,approve:count('approve'),revise:count('revise'),reject:count('reject'),blocked:(packet.blockedItems||[]).length};}
function refreshVisible(preferredId){const f=el('filter').value;visible=(packet.items||[]).filter(item=>f==='all'||(f==='awaiting'?!item.humanDecision:item.humanDecision===f));if(preferredId){const i=visible.findIndex(item=>item.queueId===preferredId);index=i>=0?i:Math.min(index,Math.max(0,visible.length-1));}else index=Math.min(index,Math.max(0,visible.length-1));render();}
function renderStats(){const s=summary();const done=s.total-s.awaiting;el('progressBar').style.width=(s.total?done/s.total*100:0)+'%';el('stats').innerHTML=[['进度',done+'/'+s.total],['待审核',s.awaiting],['通过',s.approve],['修改后通过',s.revise],['拒绝',s.reject],['Blocked',s.blocked]].map(([k,v])=>'<span class="badge">'+k+'：'+v+'</span>').join('');}
function decisionText(d){return d==='approve'?'已通过':d==='revise'?'修改后通过':d==='reject'?'已拒绝':'待审核';}
function render(){renderStats();el('prev').disabled=index<=0;el('next').disabled=index>=visible.length-1;if(!visible.length){el('card').innerHTML='<div class="empty"><h2>当前筛选范围没有项目</h2><p>待审核为 0 时，说明人工复核已经完成。</p></div>';return;}const item=visible[index];el('card').innerHTML=
'<div class="small">'+escapeHtml(item.queueId)+' · '+escapeHtml(item.priority)+' · '+(index+1)+' / '+visible.length+'</div>'+ 
'<h2 class="word">'+escapeHtml(item.word)+'</h2><p class="reading">'+escapeHtml(item.reading)+'</p>'+ 
'<div class="meta"><span class="badge">置信度：'+escapeHtml(item.confidence||'—')+'</span><span class="badge decision">'+decisionText(item.humanDecision)+'</span></div>'+ 
'<div class="candidate">中文草稿：'+escapeHtml(item.candidateChinese)+'</div>'+ 
'<h3>证据</h3><ul class="evidence">'+(item.evidenceSummary||[]).map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ul>'+ 
'<details><summary>完整审核备注</summary><p class="notes">'+escapeHtml(item.notes||'')+'</p></details>'+ 
'<div class="field" style="margin-top:16px"><label for="approvedChinese">最终中文释义</label><textarea id="approvedChinese">'+escapeHtml(item.approvedChinese||item.candidateChinese||'')+'</textarea></div>'+ 
'<div class="field" style="margin-top:12px"><label for="humanNotes">人工备注／修改或拒绝理由</label><textarea id="humanNotes">'+escapeHtml(item.humanNotes||'')+'</textarea></div>'+ 
'<div class="actions"><button class="action approve" data-decision="approve">通过并下一条</button><button class="action revise" data-decision="revise">修改后通过</button><button class="action reject" data-decision="reject">拒绝</button></div><div id="status" class="status"></div>';
document.querySelectorAll('[data-decision]').forEach(btn=>btn.addEventListener('click',()=>saveDecision(btn.dataset.decision)));}
async function saveDecision(decision){const item=visible[index];const reviewer=el('reviewer').value.trim();localStorage.setItem('yomeruHumanReviewer',reviewer);const payload={queueId:item.queueId,humanDecision:decision,humanReviewer:reviewer,approvedChinese:el('approvedChinese').value,humanNotes:el('humanNotes').value};const status=el('status');status.className='status';status.textContent='正在保存…';try{const res=await fetch('/api/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'保存失败');packet=data.packet;status.className='status ok';status.textContent='已保存';refreshVisible();}catch(error){status.className='status error';status.textContent=error.message;}}
async function load(){const res=await fetch('/api/packet');packet=await res.json();el('reviewer').value=localStorage.getItem('yomeruHumanReviewer')||'';refreshVisible();}
el('filter').addEventListener('change',()=>{index=0;refreshVisible();});el('prev').addEventListener('click',()=>{if(index>0){index--;render();}});el('next').addEventListener('click',()=>{if(index<visible.length-1){index++;render();}});load().catch(error=>{el('card').innerHTML='<div class="error">'+escapeHtml(error.message)+'</div>';});
</script>
</body>
</html>`;

export async function createReviewServer({
  packetPath = DEFAULT_PACKET_PATH,
  host = '127.0.0.1',
  port = 4175,
  openBrowser = true
} = {}) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
      if (request.method === 'GET' && url.pathname === '/') return htmlResponse(response, REVIEW_HTML);
      if (request.method === 'GET' && url.pathname === '/api/packet') return jsonResponse(response, 200, await readPacket(packetPath));
      if (request.method === 'GET' && url.pathname === '/api/status') {
        const packet = await readPacket(packetPath);
        return jsonResponse(response, 200, summarizePacket(packet));
      }
      if (request.method === 'POST' && url.pathname === '/api/decision') {
        const packet = await readPacket(packetPath);
        const payload = await readJsonBody(request);
        applyHumanDecision(packet, payload);
        await writePacketAtomic(packetPath, packet);
        return jsonResponse(response, 200, { ok: true, packet, summary: summarizePacket(packet) });
      }
      return jsonResponse(response, 404, { error: 'Not found' });
    } catch (error) {
      return jsonResponse(response, 400, { error: error?.message || String(error) });
    }
  });

  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, host, resolvePromise);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const url = `http://${host}:${actualPort}`;

  if (openBrowser && process.platform === 'darwin') {
    const child = spawn('open', [url], { detached: true, stdio: 'ignore' });
    child.unref();
  }
  return { server, url, packetPath };
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const packetPath = process.env.YOMERU_HUMAN_REVIEW_PACKET
    ? resolve(process.env.YOMERU_HUMAN_REVIEW_PACKET)
    : DEFAULT_PACKET_PATH;
  const port = Number(process.env.PORT || 4175);
  const { url } = await createReviewServer({ packetPath, port, openBrowser: process.env.NO_OPEN !== '1' });
  process.stdout.write(`Yomeru human review UI: ${url}\n`);
  process.stdout.write(`Saving decisions to: ${packetPath}\n`);
  process.stdout.write('Press Ctrl+C to stop the local review server.\n');
}
