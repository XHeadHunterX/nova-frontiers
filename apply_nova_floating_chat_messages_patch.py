from __future__ import annotations

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
ROOT = Path.cwd()
BACKEND = ROOT / 'backend' / 'app' / 'main.py'
FRONTEND = ROOT / 'frontend' / 'src' / 'main.jsx'
CSS = ROOT / 'frontend' / 'src' / 'styles.css'

BACKEND_MARKER = '# NOVA_FLOATING_CHAT_MESSAGES_PATCH_V1'
FRONTEND_MARKER = 'NOVA_FLOATING_CHAT_MESSAGES_PATCH_V1'
CSS_MARKER = 'NOVA_FLOATING_CHAT_MESSAGES_PATCH_CSS_V1'

changed: list[str] = []
skipped: list[str] = []


def fail(msg: str) -> None:
    print(f'ERROR: {msg}', file=sys.stderr)
    sys.exit(1)


def read_text(path: Path) -> str:
    if not path.exists():
        fail(f'Missing required file: {path}')
    return path.read_text(encoding='utf-8')


def backup(path: Path) -> None:
    backup_path = path.with_suffix(path.suffix + f'.bak-{STAMP}')
    if not backup_path.exists():
        shutil.copy2(path, backup_path)


def write_if_changed(path: Path, old: str, new: str, label: str) -> None:
    if new == old:
        skipped.append(f'{label}: already current or no matching insertion point')
        return
    backup(path)
    path.write_text(new, encoding='utf-8', newline='')
    changed.append(label)


def patch_backend() -> None:
    text = read_text(BACKEND)
    original = text
    if BACKEND_MARKER in text:
        skipped.append('backend/app/main.py: backend marker already present')
        return

    block = r"""

# NOVA_FLOATING_CHAT_MESSAGES_PATCH_V1
# Floating chat + direct messages. Isolated from build_state so closed chat adds no state-poll cost.
import time as _nova_chat_time
import json as _nova_chat_json
import sqlite3 as _nova_chat_sqlite3
from pathlib import Path as _NovaChatPath
from datetime import datetime as _NovaChatDatetime, timezone as _NovaChatTimezone
try:
    from fastapi import HTTPException as _NovaChatHTTPException
except Exception:  # pragma: no cover
    _NovaChatHTTPException = Exception
try:
    from pydantic import BaseModel as _NovaChatBaseModel
except Exception:  # pragma: no cover
    _NovaChatBaseModel = object


class NovaChatPostRequest(_NovaChatBaseModel):
    channel: str = 'global'
    message: str
    player_id: int | None = None
    username: str | None = None
    faction_id: int | str | None = None
    faction: str | None = None
    guild_id: int | str | None = None
    guild: str | None = None


class NovaDirectMessageRequest(_NovaChatBaseModel):
    player_id: int | None = None
    recipient_id: int | None = None
    recipient_name: str | None = None
    body: str


def _nova_chat_now_iso() -> str:
    return _NovaChatDatetime.now(_NovaChatTimezone.utc).isoformat()


def _nova_chat_json_dumps(value) -> str:
    return _nova_chat_json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def _nova_chat_raise(status_code: int, detail: str):
    try:
        raise _NovaChatHTTPException(status_code=status_code, detail=detail)
    except TypeError:
        raise _NovaChatHTTPException(detail)


def _nova_chat_candidate_db_paths() -> list[_NovaChatPath]:
    found: list[_NovaChatPath] = []
    for name in ('DB_PATH', 'DATABASE_PATH', 'DATABASE', 'SQLITE_PATH'):
        value = globals().get(name)
        if value:
            try:
                p = _NovaChatPath(str(value))
                if p.exists() or p.suffix == '.db':
                    found.append(p)
            except Exception:
                pass
    roots = []
    try:
        roots.append(_NovaChatPath(__file__).resolve().parent)
        roots.extend(_NovaChatPath(__file__).resolve().parents)
    except Exception:
        roots.append(_NovaChatPath.cwd())
    names = ('nova_frontiers.db', 'nova.db', 'game.db', 'database.db', 'app.db', 'db.sqlite3')
    for root in roots:
        for candidate in names:
            p = root / candidate
            if p.exists():
                found.append(p)
        try:
            for p in root.glob('*.db'):
                found.append(p)
        except Exception:
            pass
    out: list[_NovaChatPath] = []
    seen = set()
    for p in found:
        try:
            key = str(p.resolve())
        except Exception:
            key = str(p)
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


def _nova_chat_open_conn():
    for fn_name in ('get_conn', 'get_connection', 'connect_db', 'db_connect', 'open_db'):
        fn = globals().get(fn_name)
        if callable(fn):
            try:
                conn = fn()
                if hasattr(conn, 'execute'):
                    try:
                        conn.row_factory = _nova_chat_sqlite3.Row
                    except Exception:
                        pass
                    return conn
            except TypeError:
                pass
            except Exception:
                pass
    for p in _nova_chat_candidate_db_paths():
        try:
            conn = _nova_chat_sqlite3.connect(str(p), check_same_thread=False)
            conn.row_factory = _nova_chat_sqlite3.Row
            return conn
        except Exception:
            continue
    _nova_chat_raise(500, 'Chat database connection could not be resolved')


def _nova_chat_rows(conn, sql: str, params: tuple = ()) -> list[dict]:
    cur = conn.execute(sql, params)
    return [dict(r) for r in cur.fetchall()]


def _nova_chat_row(conn, sql: str, params: tuple = ()) -> dict | None:
    cur = conn.execute(sql, params)
    r = cur.fetchone()
    return dict(r) if r else None


def _nova_chat_table_cols(conn, table: str) -> set[str]:
    try:
        return {str(r['name']) for r in _nova_chat_rows(conn, f'PRAGMA table_info({table})')}
    except Exception:
        return set()


def _nova_chat_first_col(cols: set[str], options: tuple[str, ...]) -> str | None:
    for c in options:
        if c in cols:
            return c
    return None


def _nova_chat_ensure(conn) -> None:
    conn.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,
            faction_key TEXT,
            guild_key TEXT,
            user_id INTEGER,
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_ts REAL NOT NULL
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_chat_messages_scope ON chat_messages(channel, faction_key, guild_key, id)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_chat_messages_user_time ON chat_messages(user_id, created_ts)')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS chat_rate_limits (
            user_id INTEGER PRIMARY KEY,
            cooldown_until REAL NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS direct_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            sender_name TEXT NOT NULL,
            recipient_id INTEGER NOT NULL,
            recipient_name TEXT NOT NULL,
            body TEXT NOT NULL,
            read_at TEXT,
            created_at TEXT NOT NULL,
            created_ts REAL NOT NULL
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_direct_messages_pair ON direct_messages(sender_id, recipient_id, id)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient ON direct_messages(recipient_id, read_at, id)')


def _nova_chat_player_context(conn, player_id=None, fallback: dict | None = None) -> dict:
    fallback = dict(fallback or {})
    ctx = {
        'id': player_id or fallback.get('player_id') or fallback.get('id'),
        'username': fallback.get('username') or fallback.get('name') or 'Unknown Pilot',
        'faction_key': fallback.get('faction_id') or fallback.get('faction') or '',
        'guild_key': fallback.get('guild_id') or fallback.get('guild') or '',
    }
    pid = ctx.get('id')
    if not pid:
        return ctx
    cols = _nova_chat_table_cols(conn, 'players')
    if not cols:
        return ctx
    name_col = _nova_chat_first_col(cols, ('username', 'name', 'display_name', 'captain_name', 'pilot_name'))
    faction_col = _nova_chat_first_col(cols, ('faction_id', 'faction', 'faction_code', 'faction_name'))
    guild_col = _nova_chat_first_col(cols, ('guild_id', 'guild', 'guild_name', 'corporation_id', 'corp_id'))
    select_parts = ['id']
    if name_col:
        select_parts.append(f'{name_col} AS username')
    if faction_col:
        select_parts.append(f'{faction_col} AS faction_key')
    if guild_col:
        select_parts.append(f'{guild_col} AS guild_key')
    try:
        row_data = _nova_chat_row(conn, f"SELECT {', '.join(select_parts)} FROM players WHERE id=?", (pid,))
    except Exception:
        row_data = None
    if row_data:
        ctx.update({k: row_data.get(k) for k in ('id', 'username', 'faction_key', 'guild_key') if row_data.get(k) is not None})
    return ctx


def _nova_chat_scope(channel: str, ctx: dict) -> tuple[str, str, str]:
    ch = str(channel or 'global').strip().lower()
    if ch not in {'global', 'faction', 'guild'}:
        _nova_chat_raise(400, 'Invalid chat channel')
    faction_key = ''
    guild_key = ''
    if ch == 'faction':
        faction_key = str(ctx.get('faction_key') or '')
        if not faction_key:
            _nova_chat_raise(400, 'Faction chat requires a faction')
    if ch == 'guild':
        guild_key = str(ctx.get('guild_key') or '')
        if not guild_key:
            _nova_chat_raise(400, 'Guild chat requires a guild')
    return ch, faction_key, guild_key


def _nova_chat_public_message(row_data: dict) -> dict:
    return {
        'id': row_data.get('id'),
        'channel': row_data.get('channel'),
        'user_id': row_data.get('user_id'),
        'username': row_data.get('username'),
        'message': row_data.get('message'),
        'created_at': row_data.get('created_at'),
    }


@app.get('/api/chat/messages')
def nova_chat_messages(channel: str = 'global', player_id: int | None = None, after_id: int | None = None):
    conn = _nova_chat_open_conn()
    try:
        _nova_chat_ensure(conn)
        ctx = _nova_chat_player_context(conn, player_id)
        ch, faction_key, guild_key = _nova_chat_scope(channel, ctx)
        params: list = [ch, faction_key, guild_key]
        where = 'channel=? AND COALESCE(faction_key, \'\')=? AND COALESCE(guild_key, \'\')=?'
        if after_id:
            where += ' AND id>?'
            params.append(after_id)
        items = _nova_chat_rows(
            conn,
            f'''SELECT id, channel, user_id, username, message, created_at
                FROM chat_messages
                WHERE {where}
                ORDER BY id DESC
                LIMIT 100''',
            tuple(params),
        )
        items = list(reversed(items))
        return {'messages': [_nova_chat_public_message(r) for r in items], 'server_time': _nova_chat_now_iso()}
    finally:
        try:
            conn.close()
        except Exception:
            pass


@app.post('/api/chat/messages')
def nova_chat_send(req: NovaChatPostRequest):
    message = str(req.message or '').strip()
    if not message:
        _nova_chat_raise(400, 'Message required')
    if len(message) > 500:
        message = message[:500]
    now_ts = _nova_chat_time.time()
    conn = _nova_chat_open_conn()
    try:
        _nova_chat_ensure(conn)
        ctx = _nova_chat_player_context(conn, req.player_id, req.dict() if hasattr(req, 'dict') else req.__dict__)
        user_id = ctx.get('id')
        if not user_id:
            _nova_chat_raise(401, 'Player required')
        ch, faction_key, guild_key = _nova_chat_scope(req.channel, ctx)
        limit = _nova_chat_row(conn, 'SELECT cooldown_until FROM chat_rate_limits WHERE user_id=?', (user_id,))
        if limit and float(limit.get('cooldown_until') or 0) > now_ts:
            remaining = int(float(limit.get('cooldown_until')) - now_ts) + 1
            _nova_chat_raise(429, f'Chat cooldown active for {remaining}s')
        last_msg = _nova_chat_row(conn, 'SELECT created_ts FROM chat_messages WHERE user_id=? ORDER BY id DESC LIMIT 1', (user_id,))
        if last_msg and now_ts - float(last_msg.get('created_ts') or 0) < 3:
            _nova_chat_raise(429, 'Chat is limited to 1 message every 3 seconds')
        recent_count = _nova_chat_row(conn, 'SELECT COUNT(*) AS n FROM chat_messages WHERE user_id=? AND created_ts>=?', (user_id, now_ts - 20))
        if int((recent_count or {}).get('n') or 0) >= 5:
            conn.execute(
                'INSERT OR REPLACE INTO chat_rate_limits(user_id,cooldown_until,updated_at) VALUES(?,?,?)',
                (user_id, now_ts + 60, _nova_chat_now_iso()),
            )
            conn.commit()
            _nova_chat_raise(429, 'Too many messages. Chat cooldown active for 60s')
        created_at = _nova_chat_now_iso()
        username = str(ctx.get('username') or req.username or 'Unknown Pilot')[:80]
        cur = conn.execute(
            '''INSERT INTO chat_messages(channel,faction_key,guild_key,user_id,username,message,created_at,created_ts)
               VALUES(?,?,?,?,?,?,?,?)''',
            (ch, faction_key, guild_key, user_id, username, message, created_at, now_ts),
        )
        conn.execute(
            '''DELETE FROM chat_messages
               WHERE channel=? AND COALESCE(faction_key, '')=? AND COALESCE(guild_key, '')=?
                 AND id NOT IN (
                    SELECT id FROM chat_messages
                    WHERE channel=? AND COALESCE(faction_key, '')=? AND COALESCE(guild_key, '')=?
                    ORDER BY id DESC LIMIT 100
                 )''',
            (ch, faction_key, guild_key, ch, faction_key, guild_key),
        )
        conn.commit()
        return {'ok': True, 'message': {'id': cur.lastrowid, 'channel': ch, 'user_id': user_id, 'username': username, 'message': message, 'created_at': created_at}}
    finally:
        try:
            conn.close()
        except Exception:
            pass


@app.get('/api/messages/threads')
def nova_direct_message_threads(player_id: int):
    conn = _nova_chat_open_conn()
    try:
        _nova_chat_ensure(conn)
        ctx = _nova_chat_player_context(conn, player_id)
        user_id = ctx.get('id')
        if not user_id:
            _nova_chat_raise(401, 'Player required')
        rows_data = _nova_chat_rows(conn, '''
            SELECT dm.*,
                   CASE WHEN sender_id=? THEN recipient_id ELSE sender_id END AS other_id,
                   CASE WHEN sender_id=? THEN recipient_name ELSE sender_name END AS other_name
            FROM direct_messages dm
            JOIN (
                SELECT CASE WHEN sender_id=? THEN recipient_id ELSE sender_id END AS other_id, MAX(id) AS max_id
                FROM direct_messages
                WHERE sender_id=? OR recipient_id=?
                GROUP BY CASE WHEN sender_id=? THEN recipient_id ELSE sender_id END
            ) latest ON latest.max_id = dm.id
            ORDER BY dm.id DESC
        ''', (user_id, user_id, user_id, user_id, user_id, user_id))
        unread = _nova_chat_rows(conn, '''
            SELECT sender_id AS other_id, COUNT(*) AS unread
            FROM direct_messages
            WHERE recipient_id=? AND read_at IS NULL
            GROUP BY sender_id
        ''', (user_id,))
        unread_map = {str(r['other_id']): int(r['unread']) for r in unread}
        return {'threads': [{
            'other_id': r.get('other_id'),
            'other_name': r.get('other_name'),
            'last_body': r.get('body'),
            'last_at': r.get('created_at'),
            'unread': unread_map.get(str(r.get('other_id')), 0),
        } for r in rows_data]}
    finally:
        try:
            conn.close()
        except Exception:
            pass


@app.get('/api/messages/thread')
def nova_direct_message_thread(player_id: int, other_id: int):
    conn = _nova_chat_open_conn()
    try:
        _nova_chat_ensure(conn)
        ctx = _nova_chat_player_context(conn, player_id)
        user_id = ctx.get('id')
        if not user_id:
            _nova_chat_raise(401, 'Player required')
        items = _nova_chat_rows(conn, '''
            SELECT id, sender_id, sender_name, recipient_id, recipient_name, body, read_at, created_at
            FROM direct_messages
            WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)
            ORDER BY id ASC
            LIMIT 200
        ''', (user_id, other_id, other_id, user_id))
        conn.execute('UPDATE direct_messages SET read_at=COALESCE(read_at, ?) WHERE sender_id=? AND recipient_id=?', (_nova_chat_now_iso(), other_id, user_id))
        conn.commit()
        return {'messages': items}
    finally:
        try:
            conn.close()
        except Exception:
            pass


@app.post('/api/messages/send')
def nova_direct_message_send(req: NovaDirectMessageRequest):
    body = str(req.body or '').strip()
    if not body:
        _nova_chat_raise(400, 'Message required')
    if len(body) > 2000:
        body = body[:2000]
    if not req.recipient_id and not req.recipient_name:
        _nova_chat_raise(400, 'Recipient required')
    conn = _nova_chat_open_conn()
    try:
        _nova_chat_ensure(conn)
        sender = _nova_chat_player_context(conn, req.player_id)
        sender_id = sender.get('id')
        if not sender_id:
            _nova_chat_raise(401, 'Player required')
        recipient = None
        if req.recipient_id:
            recipient = _nova_chat_player_context(conn, req.recipient_id)
        elif req.recipient_name:
            cols = _nova_chat_table_cols(conn, 'players')
            name_col = _nova_chat_first_col(cols, ('username', 'name', 'display_name', 'captain_name', 'pilot_name'))
            if name_col:
                try:
                    r = _nova_chat_row(conn, f'SELECT id, {name_col} AS username FROM players WHERE lower({name_col})=lower(?) LIMIT 1', (req.recipient_name,))
                    if r:
                        recipient = {'id': r.get('id'), 'username': r.get('username')}
                except Exception:
                    recipient = None
        if not recipient or not recipient.get('id'):
            _nova_chat_raise(404, 'Recipient not found')
        created_at = _nova_chat_now_iso()
        cur = conn.execute(
            '''INSERT INTO direct_messages(sender_id,sender_name,recipient_id,recipient_name,body,created_at,created_ts)
               VALUES(?,?,?,?,?,?,?)''',
            (sender_id, str(sender.get('username') or 'Unknown Pilot'), recipient.get('id'), str(recipient.get('username') or req.recipient_name or 'Pilot'), body, created_at, _nova_chat_time.time()),
        )
        conn.commit()
        return {'ok': True, 'id': cur.lastrowid, 'created_at': created_at}
    finally:
        try:
            conn.close()
        except Exception:
            pass
"""

    # Append at end. FastAPI route decorators can be registered after existing routes as long as app exists.
    text = text.rstrip() + block + '\n'
    write_if_changed(BACKEND, original, text, 'backend/app/main.py')


def patch_frontend() -> None:
    text = read_text(FRONTEND)
    original = text
    if FRONTEND_MARKER in text:
        skipped.append('frontend/src/main.jsx: frontend marker already present')
        return

    block = r'''

// NOVA_FLOATING_CHAT_MESSAGES_PATCH_V1
// Self-contained global chat/messages overlay. It avoids /api/state polling unless the panel is opened.
(function novaFloatingChatMessagesPatch(){
  if (typeof window === 'undefined' || window.__novaFloatingChatMessagesPatch) return;
  window.__novaFloatingChatMessagesPatch = true;

  const cssReady = () => document.body;
  const apiJson = async (url, options = {}) => {
    const res = await fetch(url, {
      credentials: 'include',
      headers: {'Content-Type': 'application/json', ...(options.headers || {})},
      ...options,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const msg = data?.detail || data?.error || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  let cachedState = null;
  let cachedStateAt = 0;
  let currentChannel = localStorage.getItem('novaChatChannel') || 'global';
  let open = false;
  let pollTimer = null;
  let lastId = 0;
  let localSendTimes = [];
  let localCooldownUntil = 0;

  function normalizeState(data){ return data?.state || data || {}; }
  async function getState(force = false){
    if (!force && cachedState && Date.now() - cachedStateAt < 15000) return cachedState;
    cachedState = normalizeState(await apiJson('/api/state'));
    cachedStateAt = Date.now();
    return cachedState;
  }
  function playerFromState(state){
    const p = state?.player || state?.profile || state?.current_player || state?.user || {};
    const loc = state?.location || {};
    return {
      player_id: p.id ?? p.player_id ?? state?.player_id,
      username: p.username || p.name || p.display_name || p.captain_name || 'Pilot',
      faction_id: p.faction_id ?? p.faction ?? loc.faction_id ?? state?.faction_id,
      faction: p.faction || p.faction_name || loc.faction,
      guild_id: p.guild_id ?? p.guild ?? p.corporation_id ?? state?.guild_id,
      guild: p.guild || p.guild_name || p.corporation,
    };
  }
  function esc(s){
    return String(s ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function hideChatNav(){
    qsa('nav a, nav button, aside a, aside button, header a, header button, [role="navigation"] a, [role="navigation"] button').forEach(el => {
      if (el.closest('[data-nova-floating-chat]')) return;
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const href = String(el.getAttribute('href') || '').toLowerCase();
      const dataPage = String(el.getAttribute('data-page') || el.getAttribute('data-route') || '').toLowerCase();
      if (text === 'chat' || href.endsWith('#chat') || href.includes('/chat') || dataPage === 'chat') {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function ensureRoot(){
    let root = qs('[data-nova-floating-chat]');
    if (root) return root;
    root = document.createElement('div');
    root.setAttribute('data-nova-floating-chat', '1');
    root.innerHTML = `
      <button class="nova-chat-fab" type="button" title="Chat" aria-label="Open chat">✦</button>
      <section class="nova-chat-panel" hidden>
        <header class="nova-chat-head">
          <strong>Comms</strong>
          <button class="nova-chat-close" type="button" aria-label="Minimize chat">×</button>
        </header>
        <div class="nova-chat-tabs">
          <button data-channel="global" type="button">Global</button>
          <button data-channel="faction" type="button">Faction</button>
          <button data-channel="guild" type="button">Guild</button>
        </div>
        <div class="nova-chat-status"></div>
        <div class="nova-chat-list" aria-live="polite"></div>
        <form class="nova-chat-form">
          <input class="nova-chat-input" maxlength="500" autocomplete="off" placeholder="Message" />
          <button type="submit">Send</button>
        </form>
      </section>
    `;
    document.body.appendChild(root);
    root.querySelector('.nova-chat-fab').addEventListener('click', () => setOpen(true));
    root.querySelector('.nova-chat-close').addEventListener('click', () => setOpen(false));
    root.querySelectorAll('[data-channel]').forEach(btn => btn.addEventListener('click', () => switchChannel(btn.getAttribute('data-channel'))));
    root.querySelector('.nova-chat-form').addEventListener('submit', sendChatMessage);
    return root;
  }

  function setStatus(msg, isError = false){
    const el = qs('.nova-chat-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }
  function setOpen(next){
    open = !!next;
    const root = ensureRoot();
    root.querySelector('.nova-chat-panel').hidden = !open;
    root.querySelector('.nova-chat-fab').hidden = open;
    if (open) {
      lastId = 0;
      renderActiveTab();
      loadChatMessages(true);
      clearInterval(pollTimer);
      pollTimer = setInterval(() => { if (open) loadChatMessages(false); }, 2500);
    } else {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  function renderActiveTab(){
    qsa('.nova-chat-tabs [data-channel]').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-channel') === currentChannel));
  }
  function switchChannel(channel){
    currentChannel = channel || 'global';
    localStorage.setItem('novaChatChannel', currentChannel);
    lastId = 0;
    const list = qs('.nova-chat-list');
    if (list) list.innerHTML = '';
    renderActiveTab();
    loadChatMessages(true);
  }
  function appendMessages(messages, replace = false){
    const list = qs('.nova-chat-list');
    if (!list) return;
    if (replace) list.innerHTML = '';
    (messages || []).forEach(m => {
      if (m.id && Number(m.id) > lastId) lastId = Number(m.id);
      const row = document.createElement('div');
      row.className = 'nova-chat-msg';
      row.innerHTML = `<button class="nova-chat-user" data-user-id="${esc(m.user_id)}" data-username="${esc(m.username)}" type="button">${esc(m.username)}</button><span>${esc(m.message)}</span>`;
      list.appendChild(row);
    });
    while (list.children.length > 100) list.removeChild(list.firstElementChild);
    list.scrollTop = list.scrollHeight;
  }
  async function loadChatMessages(replace){
    try {
      const state = await getState(false);
      const p = playerFromState(state);
      const params = new URLSearchParams({channel: currentChannel});
      if (p.player_id) params.set('player_id', p.player_id);
      if (!replace && lastId) params.set('after_id', lastId);
      const data = await apiJson(`/api/chat/messages?${params.toString()}`);
      appendMessages(data.messages || [], replace);
      setStatus('');
    } catch (err) {
      setStatus(err.message || 'Chat unavailable', true);
    }
  }
  async function sendChatMessage(ev){
    ev.preventDefault();
    const input = qs('.nova-chat-input');
    const body = (input?.value || '').trim();
    if (!body) return;
    const now = Date.now();
    if (localCooldownUntil > now) {
      setStatus(`Cooldown ${Math.ceil((localCooldownUntil - now) / 1000)}s`, true);
      return;
    }
    localSendTimes = localSendTimes.filter(t => now - t < 20000);
    if (localSendTimes.length >= 5) {
      localCooldownUntil = now + 60000;
      setStatus('Too many messages. Cooldown 60s.', true);
      return;
    }
    if (localSendTimes.length && now - localSendTimes[localSendTimes.length - 1] < 3000) {
      setStatus('Wait 3 seconds between messages.', true);
      return;
    }
    try {
      const state = await getState(false);
      const p = playerFromState(state);
      const data = await apiJson('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({channel: currentChannel, message: body, ...p}),
      });
      localSendTimes.push(now);
      input.value = '';
      appendMessages([data.message], false);
      setStatus('');
    } catch (err) {
      if (err.status === 429) localCooldownUntil = Date.now() + 60000;
      setStatus(err.message || 'Message failed', true);
    }
  }

  function ensureMessagesPage(){
    let page = qs('[data-nova-messages-page]');
    if (page) return page;
    page = document.createElement('section');
    page.setAttribute('data-nova-messages-page', '1');
    page.hidden = true;
    page.innerHTML = `
      <div class="nova-messages-shell">
        <header class="nova-messages-head">
          <strong>Messages</strong>
          <button type="button" class="nova-messages-close">×</button>
        </header>
        <div class="nova-messages-body">
          <aside class="nova-message-threads"></aside>
          <main class="nova-message-thread">
            <div class="nova-message-empty">Select a thread or enter a pilot name.</div>
          </main>
        </div>
        <form class="nova-message-compose">
          <input class="nova-message-recipient" placeholder="Pilot name or selected profile" />
          <input class="nova-message-input" maxlength="2000" placeholder="Private message" />
          <button type="submit">Send</button>
        </form>
      </div>
    `;
    document.body.appendChild(page);
    page.querySelector('.nova-messages-close').addEventListener('click', () => { page.hidden = true; if (location.hash === '#messages') history.back(); });
    page.querySelector('.nova-message-compose').addEventListener('submit', sendDirectMessage);
    return page;
  }
  async function openMessages(target){
    const page = ensureMessagesPage();
    page.hidden = false;
    if (target?.username) page.querySelector('.nova-message-recipient').value = target.username;
    await loadThreads();
  }
  async function loadThreads(){
    try {
      const state = await getState(false);
      const p = playerFromState(state);
      if (!p.player_id) return;
      const data = await apiJson(`/api/messages/threads?player_id=${encodeURIComponent(p.player_id)}`);
      const wrap = qs('.nova-message-threads');
      wrap.innerHTML = '';
      (data.threads || []).forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nova-message-thread-btn';
        btn.innerHTML = `<strong>${esc(t.other_name)}</strong><span>${esc(t.last_body || '')}</span>${t.unread ? `<b>${t.unread}</b>` : ''}`;
        btn.addEventListener('click', () => loadThread(t.other_id, t.other_name));
        wrap.appendChild(btn);
      });
    } catch (err) {
      const wrap = qs('.nova-message-threads');
      if (wrap) wrap.textContent = err.message || 'Messages unavailable';
    }
  }
  async function loadThread(otherId, otherName){
    const state = await getState(false);
    const p = playerFromState(state);
    const data = await apiJson(`/api/messages/thread?player_id=${encodeURIComponent(p.player_id)}&other_id=${encodeURIComponent(otherId)}`);
    const thread = qs('.nova-message-thread');
    thread.innerHTML = '';
    (data.messages || []).forEach(m => {
      const div = document.createElement('div');
      div.className = `nova-direct-msg ${String(m.sender_id) === String(p.player_id) ? 'mine' : ''}`;
      div.innerHTML = `<strong>${esc(m.sender_name)}</strong><span>${esc(m.body)}</span>`;
      thread.appendChild(div);
    });
    qs('.nova-message-recipient').value = otherName || otherId;
  }
  async function sendDirectMessage(ev){
    ev.preventDefault();
    const recipient = (qs('.nova-message-recipient')?.value || '').trim();
    const body = (qs('.nova-message-input')?.value || '').trim();
    if (!recipient || !body) return;
    const state = await getState(false);
    const p = playerFromState(state);
    await apiJson('/api/messages/send', {method:'POST', body: JSON.stringify({player_id:p.player_id, recipient_name:recipient, body})});
    qs('.nova-message-input').value = '';
    await loadThreads();
  }

  window.novaOpenDirectMessages = function(target){
    location.hash = 'messages';
    openMessages(target || {});
  };

  function installProfileMessageButtons(){
    qsa('[data-user-id], [data-player-id]').forEach(el => {
      if (el.closest('[data-nova-floating-chat]') || el.closest('[data-nova-messages-page]')) return;
      if (el.querySelector?.('.nova-profile-message-btn')) return;
      const id = el.getAttribute('data-user-id') || el.getAttribute('data-player-id');
      if (!id) return;
      const username = el.getAttribute('data-username') || el.getAttribute('data-player-name') || (el.textContent || '').trim().slice(0, 80);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nova-profile-message-btn';
      btn.textContent = 'Message';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        window.novaOpenDirectMessages({user_id:id, username});
      });
      try { el.appendChild(btn); } catch {}
    });
  }

  function routeWatcher(){
    if (location.hash.replace(/^#\/?/, '') === 'messages' || location.pathname.toLowerCase().endsWith('/messages')) {
      openMessages({});
    }
  }

  function boot(){
    if (!cssReady()) return setTimeout(boot, 50);
    hideChatNav();
    ensureRoot();
    routeWatcher();
    installProfileMessageButtons();
    window.addEventListener('hashchange', routeWatcher);
    const mo = new MutationObserver(() => { hideChatNav(); installProfileMessageButtons(); });
    mo.observe(document.body, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
'''
    text = text.rstrip() + block + '\n'
    write_if_changed(FRONTEND, original, text, 'frontend/src/main.jsx')


def patch_css() -> None:
    text = read_text(CSS)
    original = text
    if CSS_MARKER in text:
        skipped.append('frontend/src/styles.css: css marker already present')
        return
    block = r'''

/* NOVA_FLOATING_CHAT_MESSAGES_PATCH_CSS_V1 */
[data-nova-floating-chat] { position: fixed; right: 18px; bottom: 18px; z-index: 9998; font-family: inherit; }
.nova-chat-fab { width: 54px; height: 54px; border-radius: 50%; border: 1px solid rgba(134,226,255,.55); background: rgba(8,16,30,.86); color: #dff8ff; box-shadow: 0 0 26px rgba(66,211,255,.35); cursor: pointer; font-size: 24px; }
.nova-chat-panel { width: min(390px, calc(100vw - 28px)); height: min(520px, calc(100vh - 92px)); display: grid; grid-template-rows: auto auto auto 1fr auto; gap: 8px; padding: 12px; border-radius: 18px; border: 1px solid rgba(126,213,255,.42); background: rgba(5,10,20,.80); backdrop-filter: blur(10px); box-shadow: 0 18px 50px rgba(0,0,0,.42); color: #ecfbff; }
.nova-chat-head { display: flex; align-items: center; justify-content: space-between; }
.nova-chat-close, .nova-messages-close { border: 0; background: rgba(255,255,255,.08); color: inherit; border-radius: 10px; width: 30px; height: 30px; cursor: pointer; }
.nova-chat-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.nova-chat-tabs button { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: inherit; border-radius: 999px; padding: 7px 8px; cursor: pointer; }
.nova-chat-tabs button.active { border-color: rgba(94,223,255,.85); background: rgba(64,183,255,.22); }
.nova-chat-status { min-height: 16px; font-size: 12px; color: rgba(222,249,255,.72); }
.nova-chat-status.error { color: #ffb5b5; }
.nova-chat-list { overflow: auto; display: flex; flex-direction: column; gap: 7px; padding-right: 4px; }
.nova-chat-msg { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: start; padding: 8px; border-radius: 12px; background: rgba(255,255,255,.055); }
.nova-chat-user { border: 0; padding: 0; background: transparent; color: #7fe8ff; font-weight: 700; cursor: pointer; text-align: left; }
.nova-chat-form { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.nova-chat-form input, .nova-message-compose input { min-width: 0; border-radius: 12px; border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.28); color: inherit; padding: 10px 12px; }
.nova-chat-form button, .nova-message-compose button, .nova-profile-message-btn { border: 1px solid rgba(106,220,255,.45); background: rgba(38,159,218,.22); color: #e8fbff; border-radius: 12px; padding: 9px 12px; cursor: pointer; }
.nova-profile-message-btn { margin-left: 8px; padding: 5px 9px; font-size: 12px; }
[data-nova-messages-page] { position: fixed; inset: 0; z-index: 9997; background: rgba(0,0,0,.42); backdrop-filter: blur(4px); padding: clamp(12px, 4vw, 44px); color: #ecfbff; }
.nova-messages-shell { width: min(980px, 100%); height: min(720px, 100%); margin: 0 auto; display: grid; grid-template-rows: auto 1fr auto; gap: 10px; border-radius: 20px; border: 1px solid rgba(126,213,255,.38); background: rgba(6,13,25,.92); padding: 14px; box-shadow: 0 22px 70px rgba(0,0,0,.52); }
.nova-messages-head { display: flex; align-items: center; justify-content: space-between; }
.nova-messages-body { display: grid; grid-template-columns: 280px 1fr; gap: 12px; min-height: 0; }
.nova-message-threads, .nova-message-thread { overflow: auto; border-radius: 14px; background: rgba(255,255,255,.045); padding: 10px; }
.nova-message-thread-btn { width: 100%; display: grid; gap: 4px; text-align: left; border: 0; border-bottom: 1px solid rgba(255,255,255,.08); background: transparent; color: inherit; padding: 10px; cursor: pointer; }
.nova-message-thread-btn span { opacity: .72; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nova-message-thread-btn b { justify-self: end; min-width: 20px; border-radius: 999px; background: #42d3ff; color: #03111c; text-align: center; font-size: 12px; }
.nova-direct-msg { max-width: 78%; margin: 8px 0; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.07); display: grid; gap: 4px; }
.nova-direct-msg.mine { margin-left: auto; background: rgba(64,183,255,.20); }
.nova-message-compose { display: grid; grid-template-columns: 220px 1fr auto; gap: 8px; }
@media (max-width: 720px) { .nova-messages-body { grid-template-columns: 1fr; } .nova-message-compose { grid-template-columns: 1fr; } }
'''
    text = text.rstrip() + block + '\n'
    write_if_changed(CSS, original, text, 'frontend/src/styles.css')


def main() -> None:
    patch_backend()
    patch_frontend()
    patch_css()
    print('\nNova floating chat/messages patch complete.')
    if changed:
        print('\nChanged:')
        for item in changed:
            print(f'  - {item}')
    if skipped:
        print('\nSkipped/Notes:')
        for item in skipped:
            print(f'  - {item}')
    print('\nBackups were created beside edited files with .bak-' + STAMP)


if __name__ == '__main__':
    main()
