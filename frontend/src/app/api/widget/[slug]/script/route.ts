import { NextRequest, NextResponse } from 'next/server'
import { db } from '../../../../../lib/db'

// GET /api/widget/{slug}/script — Returns embeddable JavaScript widget
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // 1. Fetch tenant + BotConfig
  const result = await db.execute({
    sql: `SELECT t.id, t.active, bc.bot_name, bc.greeting, bc.web_widget_theme
          FROM Tenant t
          LEFT JOIN BotConfig bc ON bc.tenant_id = t.id
          WHERE t.slug = ?`,
    args: [slug],
  })

  if (result.rows.length === 0) {
    return new NextResponse('/* widget not found */', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript' },
    })
  }

  const row = result.rows[0]
  if (row.active === 0) {
    return new NextResponse('/* widget disabled */', {
      status: 403,
      headers: { 'Content-Type': 'application/javascript' },
    })
  }

  // 2. Parse theme config
  let theme: { primaryColor?: string; position?: string } = {}
  try {
    theme = JSON.parse((row.web_widget_theme as string) || '{}')
  } catch {
    theme = {}
  }

  const primaryColor = theme.primaryColor || '#4F46E5'
  const position = (theme.position === 'bottom-left' ? 'bottom-left' : 'bottom-right') as 'bottom-right' | 'bottom-left'
  const isLeft = position === 'bottom-left'
  const posSide = isLeft ? 'left' : 'right'
  const posSideOpp = isLeft ? 'right' : 'left'
  const botName = (row.bot_name as string) || 'Tro ly ao'
  const greeting = (row.greeting as string) || 'Xin chao! Toi co the giup gi cho ban?'

  // 3. Build the script
  const script = `(function(){
'use strict';

// Multi-widget guard
var _slug = ${JSON.stringify(slug)};
var _loadedKey = '__GW_LOADED_' + _slug + '__';
if (window[_loadedKey]) return;
window[_loadedKey] = true;

// Config
var PRIMARY = ${JSON.stringify(primaryColor)};
var BOT_NAME = ${JSON.stringify(botName)};
var GREETING = ${JSON.stringify(greeting)};
var POS = ${JSON.stringify(position)};
var POS_SIDE = ${JSON.stringify(posSide)};
var POS_SIDE_OPP = ${JSON.stringify(posSideOpp)};
var SESSION_KEY = 'gw_chat_' + _slug + '_session';
var IDLE_MS = 24 * 60 * 60 * 1000; // 24h

// Helper: darken color for hover
function darken(hex, pct) {
  var n = parseInt(hex.replace('#',''), 16);
  var r = Math.max(0, ((n >> 16) & 0xFF) * (1 - pct)) | 0;
  var g = Math.max(0, ((n >> 8) & 0xFF) * (1 - pct)) | 0;
  var b = Math.max(0, (n & 0xFF) * (1 - pct)) | 0;
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// Helper: hex to rgba
function hexRgba(hex, alpha) {
  var n = parseInt(hex.replace('#',''), 16);
  var r = (n >> 16) & 0xFF, g = (n >> 8) & 0xFF, b = n & 0xFF;
  return 'rgba('+r+','+g+','+b+','+alpha+')';
}

// Session management
function getSession() {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (Date.now() - data.ts > IDLE_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch(e) { return null; }
}

function saveSession(id) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: id, ts: Date.now() }));
  } catch(e) {}
}

function newSessionId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

function getOrCreateSession() {
  var s = getSession();
  if (s && s.id) return s.id;
  var id = newSessionId();
  saveSession(id);
  return id;
}

// ── Styles ──────────────────────────────────────
var style = document.createElement('style');
style.textContent = [
  '#gw-widget-btn{',
  '  position:fixed;bottom:20px;'+posSide+':20px;width:60px;height:60px;',
  '  border-radius:50%;background:'+PRIMARY+';color:#fff;border:none;',
  '  cursor:pointer;z-index:2147483646;display:flex;align-items:center;',
  '  justify-content:center;box-shadow:0 4px 14px '+hexRgba(PRIMARY,0.4)+';',
  '  transition:transform 0.2s,background 0.2s;font-size:28px;line-height:1;',
  '}',
  '#gw-widget-btn:hover{background:'+darken(PRIMARY,0.15)+';transform:scale(1.08);}',
  '#gw-chat-box{',
  '  position:fixed;bottom:90px;'+posSide+':20px;width:380px;max-width:calc(100vw - 32px);',
  '  height:520px;max-height:calc(100vh - 120px);background:#fff;',
  '  border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);',
  '  z-index:2147483646;display:none;flex-direction:column;overflow:hidden;',
  '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
  '}',
  '#gw-chat-box.gw-open{display:flex;}',
  '#gw-chat-header{',
  '  background:'+PRIMARY+';color:#fff;padding:14px 16px;display:flex;',
  '  align-items:center;gap:10px;flex-shrink:0;',
  '}',
  '#gw-chat-header h3{margin:0;font-size:16px;font-weight:600;}',
  '#gw-chat-header button{',
  '  margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;',
  '  font-size:22px;line-height:1;padding:0 4px;',
  '}',
  '#gw-chat-messages{',
  '  flex:1;overflow-y:auto;padding:12px 14px;display:flex;',
  '  flex-direction:column;gap:8px;background:#f8f9fa;',
  '}',
  '.gw-msg{max-width:80%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.45;word-wrap:break-word;}',
  '.gw-msg-bot{background:#fff;color:#1a1a1a;align-self:flex-start;border:1px solid #e5e7eb;}',
  '.gw-msg-user{background:'+PRIMARY+';color:#fff;align-self:flex-end;}',
  '.gw-msg-typing{color:#888;font-style:italic;font-size:13px;align-self:flex-start;}',
  '#gw-chat-input-area{',
  '  display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e5e7eb;',
  '  background:#fff;flex-shrink:0;',
  '}',
  '#gw-chat-input-area input{',
  '  flex:1;border:1px solid #ddd;border-radius:20px;padding:8px 14px;',
  '  font-size:14px;outline:none;font-family:inherit;',
  '}',
  '#gw-chat-input-area input:focus{border-color:'+PRIMARY+';}',
  '#gw-chat-input-area button{',
  '  background:'+PRIMARY+';color:#fff;border:none;border-radius:50%;',
  '  width:38px;height:38px;cursor:pointer;font-size:18px;',
  '  display:flex;align-items:center;justify-content:center;flex-shrink:0;',
  '  transition:background 0.2s;',
  '}',
  '#gw-chat-input-area button:hover{background:'+darken(PRIMARY,0.15)+';}',
  '#gw-chat-input-area button:disabled{opacity:0.5;cursor:not-allowed;}',
  '@media(max-width:480px){',
  '  #gw-chat-box{bottom:0;'+posSide+':0;width:100%;height:100%;max-width:100%;max-height:100%;border-radius:0;}',
  '  #gw-widget-btn{bottom:12px;'+posSide+':12px;}',
  '}'
].join('\\n');
document.head.appendChild(style);

// ── DOM ─────────────────────────────────────────
// Floating button
var btn = document.createElement('button');
btn.id = 'gw-widget-btn';
btn.setAttribute('aria-label', 'Open chat');
btn.textContent = '\\u{1F4AC}'; // speech balloon

// Chat box
var box = document.createElement('div');
box.id = 'gw-chat-box';
box.setAttribute('role', 'dialog');
box.setAttribute('aria-label', 'Chat window');

// Header
var header = document.createElement('div');
header.id = 'gw-chat-header';
var titleEl = document.createElement('h3');
titleEl.textContent = BOT_NAME; // textContent = XSS safe
var closeBtn = document.createElement('button');
closeBtn.setAttribute('aria-label', 'Close chat');
closeBtn.textContent = '\\u00D7'; // multiplication sign
header.appendChild(titleEl);
header.appendChild(closeBtn);

// Messages area
var msgArea = document.createElement('div');
msgArea.id = 'gw-chat-messages';
msgArea.setAttribute('role', 'log');

// Input area
var inputArea = document.createElement('div');
inputArea.id = 'gw-chat-input-area';
var input = document.createElement('input');
input.type = 'text';
input.placeholder = 'Nhap tin nhan...';
input.setAttribute('aria-label', 'Message input');
var sendBtn = document.createElement('button');
sendBtn.setAttribute('aria-label', 'Send message');
sendBtn.textContent = '\\u27A4'; // arrow
inputArea.appendChild(input);
inputArea.appendChild(sendBtn);

box.appendChild(header);
box.appendChild(msgArea);
box.appendChild(inputArea);
document.body.appendChild(btn);
document.body.appendChild(box);

// ── State ───────────────────────────────────────
var isOpen = false;
var isSending = false;
var loadedHistory = false;
var sessionId = getOrCreateSession();

// ── Rendering (textContent only, no innerHTML) ──
function appendMsg(text, role) {
  var div = document.createElement('div');
  div.className = 'gw-msg gw-msg-' + role;
  div.textContent = text; // XSS safe
  msgArea.appendChild(div);
  msgArea.scrollTop = msgArea.scrollHeight;
  return div;
}

function showTyping() {
  return appendMsg('Dang nhap...', 'typing');
}

function removeTyping(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ── Load history ────────────────────────────────
async function loadHistory() {
  if (loadedHistory) return;
  loadedHistory = true;
  try {
    var resp = await fetch('/api/chat/' + _slug + '/sessions/' + sessionId);
    if (!resp.ok) return; // endpoint may not exist yet — fail silent
    var data = await resp.json();
    if (data && Array.isArray(data.messages)) {
      data.messages.forEach(function(m) {
        var role = m.role === 'assistant' ? 'bot' : 'user';
        appendMsg(m.content || '', role);
      });
    }
  } catch(e) { /* silent */ }
  // Show greeting if no history
  if (msgArea.children.length === 0) {
    appendMsg(GREETING, 'bot');
  }
}

// ── Send message ────────────────────────────────
async function sendMessage() {
  var text = input.value.trim();
  if (!text || isSending) return;

  appendMsg(text, 'user');
  input.value = '';
  isSending = true;
  sendBtn.disabled = true;
  var typingEl = showTyping();

  try {
    var resp = await fetch('/api/chat/' + _slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId }),
    });
    removeTyping(typingEl);

    if (!resp.ok) {
      appendMsg('Xin loi, co loi xay ra. Vui long thu lai.', 'bot');
      return;
    }

    var data = await resp.json();
    // Update session if server returned new one
    if (data.session_id && data.session_id !== sessionId) {
      sessionId = data.session_id;
      saveSession(sessionId);
    } else {
      // Touch timestamp
      saveSession(sessionId);
    }

    appendMsg(data.reply || 'Khong co phan hoi.', 'bot');
  } catch(e) {
    removeTyping(typingEl);
    appendMsg('Khong the ket noi. Vui long thu lai.', 'bot');
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

// ── Open / Close ────────────────────────────────
function openChat() {
  isOpen = true;
  box.classList.add('gw-open');
  btn.style.display = 'none';
  input.focus();
  loadHistory();
}

function closeChat() {
  isOpen = false;
  box.classList.remove('gw-open');
  btn.style.display = 'flex';
}

// ── Events ──────────────────────────────────────
btn.addEventListener('click', openChat);
closeBtn.addEventListener('click', closeChat);
sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Cleanup on unload
function cleanup() {
  btn.removeEventListener('click', openChat);
  closeBtn.removeEventListener('click', closeChat);
  sendBtn.removeEventListener('click', sendMessage);
}
window.addEventListener('beforeunload', cleanup);

})();`

  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
