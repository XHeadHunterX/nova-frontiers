from __future__ import annotations

import json
import math
import os
import random
import time
import uuid
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(exist_ok=True)
STATE_PATH = DATA_DIR / "state.json"

HOST = "127.0.0.1"
PORT = int(os.getenv("NOVA_PORT", "8000"))

def now() -> float:
    return time.time()

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def dist(a, b):
    return math.sqrt((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2)

def lerp(a, b, t):
    return a + (b - a) * t

def travel_progress(obj, t=None):
    t = now() if t is None else t
    start = obj.get("start_time") or t
    end = obj.get("arrival_time") or t
    if end <= start:
        return 1.0
    return clamp((t - start) / (end - start), 0.0, 1.0)

def current_xy(obj, t=None):
    t = now() if t is None else t
    if not obj.get("traveling"):
        return {"x": obj.get("x", 0), "y": obj.get("y", 0)}
    p = travel_progress(obj, t)
    a = obj["origin"]
    b = obj["destination"]
    return {"x": lerp(a["x"], b["x"], p), "y": lerp(a["y"], b["y"], p)}

def make_planets():
    return [
        {"id":"solace","name":"Solace Prime","kind":"Core World","x":420,"y":340,"security":86,"market":74,"faction":"Civic Compact","economy":"Medical / Consumer"},
        {"id":"kestrel","name":"Kestrel Station","kind":"Orbital Station","x":720,"y":215,"security":69,"market":82,"faction":"Free Dockmasters","economy":"Trade Hub"},
        {"id":"brim","name":"Brimstone Reach","kind":"Mining Belt","x":980,"y":480,"security":38,"market":51,"faction":"Ore Syndicate","economy":"Mining"},
        {"id":"vesper","name":"Vesper Gate","kind":"Frontier Port","x":310,"y":690,"security":44,"market":63,"faction":"Neutral Houses","economy":"Logistics"},
        {"id":"nocturne","name":"Nocturne Drift","kind":"Shadow Anchorage","x":830,"y":765,"security":18,"market":88,"faction":"Black Lane Brokers","economy":"Illicit / Salvage"},
        {"id":"aurelian","name":"Aurelian Yard","kind":"Shipyard","x":1180,"y":260,"security":73,"market":58,"faction":"Aurelian Foundry","economy":"Shipwright"},
        {"id":"eos","name":"Eos Relay","kind":"Relay Moon","x":145,"y":455,"security":62,"market":45,"faction":"Signal Guild","economy":"Exploration"},
    ]

def planet_by_id(state, pid):
    return next((p for p in state["planets"] if p["id"] == pid), None)

def nearest_planet(state, x, y):
    probe = {"x":x,"y":y}
    return min(state["planets"], key=lambda p: dist(probe, p))

def make_market():
    goods = [
        ("food","Hydroponic Food",12,240,40,False),
        ("meds","Trauma Meds",85,70,76,False),
        ("ore","Titanium Ore",38,130,52,False),
        ("circuit","Quantum Circuits",210,32,68,False),
        ("fuelcell","Fuel Cells",45,180,55,False),
        ("relic","Unregistered Relics",460,16,91,True),
        ("spice","Black-Lane Spice",325,24,86,True),
    ]
    return [
        {"code":c,"name":n,"price":p,"stock":s,"demand":d,"illegal":il,"trend":random.choice([-1,0,1])}
        for c,n,p,s,d,il in goods
    ]

def make_npcs(planets):
    roles = ["trader","hauler","miner","patrol","pirate","salvager"]
    names = ["Kite","Mako","Juniper","Rook","Halcyon","Valkyr","Needle","Orchid","Gannet","Morrow","Cipher","Brass"]
    npcs = []
    for i in range(18):
        p = random.choice(planets)
        npcs.append({
            "id": f"npc-{i+1}",
            "name": f"{random.choice(names)}-{random.randint(10,99)}",
            "role": random.choice(roles),
            "x": p["x"] + random.randint(-60,60),
            "y": p["y"] + random.randint(-60,60),
            "location_id": p["id"],
            "traveling": False,
            "origin": None,
            "destination": None,
            "destination_id": None,
            "start_time": None,
            "arrival_time": None,
            "stance": random.choice(["lawful","neutral","shady","hostile"]),
        })
    return npcs

def make_signatures(planets):
    sigs = []
    for i in range(10):
        p = random.choice(planets)
        sigs.append({
            "id": f"ore-{i+1}",
            "type": "ore",
            "name": random.choice(["Low-density Ore Signature","Rare Vein Flicker","Cold Iron Bloom","Silicate Pocket"]),
            "x": p["x"] + random.randint(-120,120),
            "y": p["y"] + random.randint(-120,120),
            "richness": random.randint(0, 95),
        })
    wrecks = []
    for i in range(7):
        p = random.choice(planets)
        wrecks.append({
            "id": f"wreck-{i+1}",
            "type": "wreck",
            "name": random.choice(["Derelict Hull","Cold Wreck","Split Cargo Frame","Burned Patrol Skiff"]),
            "x": p["x"] + random.randint(-145,145),
            "y": p["y"] + random.randint(-145,145),
            "value": random.randint(0, 1200),
        })
    return sigs + wrecks

def fresh_state():
    planets = make_planets()
    start = planets[0]
    t = now()
    return {
        "created_at": t,
        "server_time": t,
        "tick": 0,
        "session": {},
        "player": {
            "callsign": "pilot",
            "god_mode": False,
            "credits": 6500,
            "cargo": 0,
            "max_cargo": 80,
            "fuel": 120,
            "max_fuel": 120,
            "hull": 100,
            "shield": 100,
            "energy": 100,
            "location_id": start["id"],
            "x": start["x"],
            "y": start["y"],
            "traveling": False,
            "origin": None,
            "destination": None,
            "destination_id": None,
            "start_time": None,
            "arrival_time": None,
            "cargo_timer": None,
            "follow_target_id": None,
            "ship": {"name":"Wayfarer","drive_speed":1.0,"mining":42,"stealth":36,"combat":44},
        },
        "planets": planets,
        "market": make_market(),
        "inventory": [],
        "npcs": make_npcs(planets),
        "signatures": make_signatures(planets),
        "events": ["Universe seeded. Ships are moving. Markets are open."],
    }

def load_state():
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    state = fresh_state()
    save_state(state)
    return state

def save_state(state):
    state["server_time"] = now()
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")

def log_event(state, msg):
    state["events"] = [msg] + state.get("events", [])
    state["events"] = state["events"][:40]

def resolve_player(state):
    p = state["player"]
    t = now()

    if p.get("traveling") and travel_progress(p, t) >= 1.0:
        dest = planet_by_id(state, p.get("destination_id"))
        if dest:
            p["x"], p["y"] = dest["x"], dest["y"]
            p["location_id"] = dest["id"]
            log_event(state, f"{p['callsign']} arrived at {dest['name']}.")
        p["traveling"] = False
        p["origin"] = p["destination"] = None
        p["destination_id"] = None
        p["start_time"] = p["arrival_time"] = None
        p["follow_target_id"] = None

    timer = p.get("cargo_timer")
    if timer and t >= timer.get("complete_at", t):
        qty = int(timer.get("qty", 0))
        if timer["type"] == "load":
            p["cargo"] = clamp(p["cargo"] + qty, 0, p["max_cargo"])
            log_event(state, f"Cargo loading finished: +{qty} units.")
        elif timer["type"] == "offload":
            p["cargo"] = clamp(p["cargo"] - qty, 0, p["max_cargo"])
            p["credits"] += qty * timer.get("price", 20)
            log_event(state, f"Cargo offloaded: -{qty} units, +{qty * timer.get('price',20)} credits.")
        p["cargo_timer"] = None

def start_npc_travel(state, npc):
    planets = state["planets"]
    here = nearest_planet(state, npc.get("x",0), npc.get("y",0))
    dest = random.choice([p for p in planets if p["id"] != here["id"]])
    speed = {"trader":0.8,"hauler":0.65,"miner":0.7,"patrol":1.15,"pirate":1.25,"salvager":0.9}.get(npc["role"],0.8)
    d = dist(here, dest)
    duration = max(10, d / (28 * speed))
    t = now()
    npc.update({
        "traveling": True,
        "origin": {"x": npc.get("x", here["x"]), "y": npc.get("y", here["y"])},
        "destination": {"x": dest["x"] + random.randint(-45,45), "y": dest["y"] + random.randint(-45,45)},
        "destination_id": dest["id"],
        "start_time": t,
        "arrival_time": t + duration
    })

def simulate_npcs(state):
    t = now()
    for npc in state["npcs"]:
        if npc.get("traveling"):
            if travel_progress(npc, t) >= 1.0:
                xy = current_xy(npc, t)
                npc["x"], npc["y"] = xy["x"], xy["y"]
                npc["location_id"] = npc.get("destination_id")
                npc["traveling"] = False
                npc["origin"] = npc["destination"] = None
                npc["destination_id"] = None
                npc["start_time"] = npc["arrival_time"] = None

                if random.random() < 0.35:
                    g = random.choice(state["market"])
                    delta = random.randint(-8, 12)
                    if npc["role"] in ("trader","hauler"):
                        g["stock"] = max(0, g["stock"] + delta)
                        g["trend"] = 1 if delta < 0 else -1
                    if npc["role"] == "miner":
                        g["stock"] += random.randint(2, 18)
                    log_event(state, f"NPC {npc['name']} completed a {npc['role']} route.")
            continue

        if random.random() < 0.18:
            start_npc_travel(state, npc)

        if npc["role"] == "pirate" and random.random() < 0.025:
            xy = {"x": npc.get("x",0) + random.randint(-35,35), "y": npc.get("y",0) + random.randint(-35,35)}
            state["signatures"].append({
                "id": f"wreck-{uuid.uuid4().hex[:8]}",
                "type": "wreck",
                "name": "Fresh Combat Wreck",
                "x": xy["x"], "y": xy["y"],
                "value": random.choice([0, 0, random.randint(120, 2200)])
            })
            state["signatures"] = state["signatures"][-28:]
            log_event(state, "A pirate clash left a salvage contact on the map.")

def background_tick(state):
    last = state.get("last_sim_at", state.get("created_at", now()))
    t = now()
    if t - last < 3:
        return
    loops = min(5, int((t - last) // 3))
    for _ in range(loops):
        state["tick"] = state.get("tick", 0) + 1
        simulate_npcs(state)
        if random.random() < 0.15:
            p = random.choice(state["planets"])
            state["signatures"].append({
                "id": f"ore-{uuid.uuid4().hex[:8]}",
                "type": "ore",
                "name": random.choice(["Faint Ore Signature","Unstable Mineral Bloom","Quiet Ice-Vein"]),
                "x": p["x"] + random.randint(-130,130),
                "y": p["y"] + random.randint(-130,130),
                "richness": random.randint(0,95)
            })
            state["signatures"] = state["signatures"][-28:]
    state["last_sim_at"] = t

def public_state(state):
    resolve_player(state)
    background_tick(state)
    t = now()
    out = json.loads(json.dumps(state))
    out["server_time"] = t
    for npc in out["npcs"]:
        xy = current_xy(npc, t)
        npc["render_x"], npc["render_y"] = xy["x"], xy["y"]
        npc["progress"] = travel_progress(npc, t) if npc.get("traveling") else 0
    p = out["player"]
    xy = current_xy(p, t)
    p["render_x"], p["render_y"] = xy["x"], xy["y"]
    p["progress"] = travel_progress(p, t) if p.get("traveling") else 0
    p["location"] = planet_by_id(out, p.get("location_id"))
    return out

def deny_if_busy(state):
    p = state["player"]
    if p.get("cargo_timer"):
        return "Cannot do that while cargo is loading/offloading."
    return None

def action_login(state, payload):
    callsign = (payload.get("username") or "pilot").strip() or "pilot"
    god = callsign.lower() == "godmode" or payload.get("password") == "godmode123"
    state["player"]["callsign"] = callsign
    state["player"]["god_mode"] = bool(god)
    if god:
        state["player"]["credits"] = max(state["player"]["credits"], 1000000)
        state["player"]["fuel"] = state["player"]["max_fuel"]
    token = uuid.uuid4().hex
    state["session"][token] = {"callsign": callsign, "created_at": now()}
    log_event(state, f"{callsign} logged in.")
    return {"token": token, "message": "Logged in."}

def action_travel(state, payload):
    block = deny_if_busy(state)
    if block:
        return {"error": block}
    p = state["player"]
    if p.get("traveling"):
        return {"error": "Already traveling."}
    dest = planet_by_id(state, payload.get("planet_id"))
    if not dest:
        return {"error": "Destination not found."}
    start_xy = current_xy(p)
    d = dist(start_xy, dest)
    speed = p["ship"]["drive_speed"] * (7.0 if p.get("god_mode") else 1.0)
    duration = max(4 if p.get("god_mode") else 18, d / (22 * speed))
    fuel_cost = max(1, int(d / 140))
    if p["fuel"] < fuel_cost and not p.get("god_mode"):
        return {"error": "Not enough fuel."}
    p["fuel"] = max(0, p["fuel"] - fuel_cost)
    t = now()
    p.update({
        "traveling": True,
        "origin": {"x": start_xy["x"], "y": start_xy["y"]},
        "destination": {"x": dest["x"], "y": dest["y"]},
        "destination_id": dest["id"],
        "start_time": t,
        "arrival_time": t + duration,
        "follow_target_id": None
    })
    log_event(state, f"Travel started toward {dest['name']} ({int(duration)} sec).")
    return {"message": f"Travel started toward {dest['name']}."}

def action_go_here(state, payload):
    block = deny_if_busy(state)
    if block:
        return {"error": block}
    p = state["player"]
    if p.get("traveling"):
        return {"error": "Already traveling."}
    x = float(payload.get("x", p["x"]))
    y = float(payload.get("y", p["y"]))
    start_xy = current_xy(p)
    d = dist(start_xy, {"x":x,"y":y})
    duration = max(8, d / (24 * p["ship"]["drive_speed"]))
    t = now()
    p.update({
        "traveling": True,
        "origin": {"x": start_xy["x"], "y": start_xy["y"]},
        "destination": {"x": x, "y": y},
        "destination_id": None,
        "start_time": t,
        "arrival_time": t + duration,
        "follow_target_id": None
    })
    log_event(state, f"Free-space course plotted ({int(duration)} sec).")
    return {"message": "Free-space course plotted."}

def action_cargo(state, payload, typ):
    p = state["player"]
    if p.get("traveling"):
        return {"error":"Cannot load or offload while traveling."}
    if p.get("cargo_timer"):
        return {"error":"Cargo operation already in progress."}
    qty = int(payload.get("qty", 20))
    qty = max(1, min(40, qty))
    if typ == "load":
        qty = min(qty, p["max_cargo"] - p["cargo"])
        if qty <= 0:
            return {"error":"Cargo hold is full."}
        duration = 6 + qty * (0.6 if p.get("god_mode") else 1.25)
        price = 0
    else:
        qty = min(qty, p["cargo"])
        if qty <= 0:
            return {"error":"No cargo to offload."}
        duration = 5 + qty * (0.5 if p.get("god_mode") else 1.1)
        price = random.randint(18, 45)
    p["cargo_timer"] = {"type":typ, "qty":qty, "started_at":now(), "complete_at":now()+duration, "price":price}
    log_event(state, f"Cargo {typ} timer started: {qty} units.")
    return {"message": f"Cargo {typ} started for {qty} units."}

def action_mine(state, payload):
    block = deny_if_busy(state)
    if block:
        return {"error": block}
    sig = next((s for s in state["signatures"] if s["id"] == payload.get("id") and s["type"] == "ore"), None)
    if not sig:
        return {"error":"Ore signature not found."}
    p = state["player"]
    roll = random.randint(0, 100) + int(p["ship"]["mining"] / 4)
    qty = 0 if roll < 30 or sig.get("richness",0) == 0 else random.randint(1, max(2, int(sig.get("richness",20)/8)))
    p["cargo"] = min(p["max_cargo"], p["cargo"] + qty)
    state["signatures"] = [s for s in state["signatures"] if s["id"] != sig["id"]]
    msg = f"Mining complete: {qty} ore units recovered."
    log_event(state, msg)
    return {"message": msg}

def action_salvage(state, payload):
    block = deny_if_busy(state)
    if block:
        return {"error": block}
    sig = next((s for s in state["signatures"] if s["id"] == payload.get("id") and s["type"] == "wreck"), None)
    if not sig:
        return {"error":"Wreck not found."}
    value = int(sig.get("value",0))
    recovered = 0 if value <= 0 or random.random() < 0.22 else random.randint(20, max(50, value))
    state["player"]["credits"] += recovered
    state["signatures"] = [s for s in state["signatures"] if s["id"] != sig["id"]]
    msg = f"Salvage complete: {recovered} credits recovered."
    log_event(state, msg)
    return {"message": msg}

def action_npc(state, payload, verb):
    block = deny_if_busy(state)
    if block:
        return {"error": block}
    npc = next((n for n in state["npcs"] if n["id"] == payload.get("id")), None)
    if not npc:
        return {"error":"NPC not found."}
    p = state["player"]
    local = planet_by_id(state, p.get("location_id")) or nearest_planet(state, p.get("x",0), p.get("y",0))
    security = local.get("security",50)
    if verb == "follow":
        p["follow_target_id"] = npc["id"]
        msg = f"Following {npc['name']}."
    elif verb == "intercept":
        chance = clamp(70 - security//3 + p["ship"]["combat"]//5, 10, 90)
        success = random.randint(1,100) <= chance
        msg = f"Intercept {'succeeded' if success else 'failed'} against {npc['name']}."
        if not success and security > 60:
            p["credits"] = max(0, p["credits"] - security * 3)
            msg += " Patrol transponder logged a fine."
    elif verb == "attack":
        if p.get("cargo_timer"):
            return {"error":"Player cannot be attacked while loading/offloading."}
        chance = clamp(55 - security//4 + p["ship"]["combat"]//3, 8, 86)
        success = random.randint(1,100) <= chance
        if success:
            gain = random.randint(80, 900)
            p["credits"] += gain
            msg = f"Attack won against {npc['name']}: +{gain} credits."
            if random.random() < 0.45:
                xy = current_xy(npc)
                state["signatures"].append({"id":f"wreck-{uuid.uuid4().hex[:8]}","type":"wreck","name":f"{npc['name']} Wreck","x":xy["x"],"y":xy["y"],"value":random.choice([0, random.randint(100,1600)])})
        else:
            dmg = random.randint(4, 20) + security//10
            p["hull"] = max(0, p["hull"] - dmg)
            fine = security * 6 if security > 45 else 0
            p["credits"] = max(0, p["credits"] - fine)
            msg = f"Attack failed. Hull -{dmg}. Security fine {fine}."
    else:
        msg = f"{npc['name']} is a {npc['role']} pilot, stance {npc['stance']}."
    log_event(state, msg)
    return {"message": msg}

def action_refuel(state):
    p = state["player"]
    need = p["max_fuel"] - p["fuel"]
    cost = need * 3
    if p["credits"] < cost:
        return {"error":"Not enough credits."}
    p["credits"] -= cost
    p["fuel"] = p["max_fuel"]
    log_event(state, f"Refueled for {cost} credits.")
    return {"message": f"Refueled for {cost} credits."}

def dispatch_action(state, payload):
    typ = payload.get("type")
    data = payload.get("payload") or {}
    if typ == "login":
        return action_login(state, data)
    if typ == "travel":
        return action_travel(state, data)
    if typ == "go_here":
        return action_go_here(state, data)
    if typ == "load_cargo":
        return action_cargo(state, data, "load")
    if typ == "offload_cargo":
        return action_cargo(state, data, "offload")
    if typ == "mine":
        return action_mine(state, data)
    if typ == "salvage":
        return action_salvage(state, data)
    if typ in ("inspect_npc","intercept","attack","follow"):
        verb = {"inspect_npc":"inspect","intercept":"intercept","attack":"attack","follow":"follow"}[typ]
        return action_npc(state, data, verb)
    if typ == "refuel":
        return action_refuel(state)
    if typ == "reset":
        fresh = fresh_state()
        state.clear()
        state.update(fresh)
        return {"message":"Universe reset."}
    return {"error": f"Unknown action: {typ}"}

class Handler(SimpleHTTPRequestHandler):
    server_version = "NovaFrontiersPhase22/1.0"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, obj, status=200):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            return self.send_json({"ok": True, "server_time": now()})
        if path == "/api/state":
            state = load_state()
            out = public_state(state)
            save_state(state)
            return self.send_json(out)

        if path == "/":
            path = "/index.html"
        target = (FRONTEND / path.lstrip("/")).resolve()
        if not str(target).startswith(str(FRONTEND.resolve())) or not target.exists():
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
            return
        self.path = str(target)
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/action":
            return self.send_json({"error":"Not found"}, 404)
        state = load_state()
        resolve_player(state)
        background_tick(state)
        payload = self.read_json()
        result = dispatch_action(state, payload)
        out = public_state(state)
        save_state(state)
        status = 400 if "error" in result else 200
        return self.send_json({"result": result, "state": out}, status)

if __name__ == "__main__":
    os.chdir(str(FRONTEND))
    print(f"Nova Frontiers Phase 22 running at http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
