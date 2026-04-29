from fastapi.testclient import TestClient
import uuid
from app.main import app, migrate

migrate()
c = TestClient(app)

def login(username, password):
    res = c.post('/api/auth/login', json={'username': username, 'password': password})
    assert res.status_code == 200, res.text
    return {'Authorization': f"Bearer {res.json()['token']}"}

h = login('godmode', 'godmode123')
state = c.get('/api/state', headers=h).json()
assert state['user']['god_mode'] is True
assert state['next_level_xp'] > 0

actions = [
    ('admin_godmode', {}),
    ('simulate_npc_tick', {}),
    ('travel', {'planet_id': state['planets'][1]['id']}),
    ('pve_operation', {'code': 'bounty_hunt'}),
    ('run_smuggling_route', {'qty': 2}),
    ('mine', {}),
    ('salvage', {}),
    ('craft', {'recipe': 'ammo'}),
    ('craft', {'recipe': 'field_rations'}),
    ('craft', {'recipe': 'trauma_gel'}),
    ('craft', {'recipe': 'synthetic_fuel'}),
    ('craft', {'recipe': 'combat_stim_batch'}),
    ('repair_refuel', {}),
    ('career_task', {}),
    ('hospital_expedite', {'minutes': 30}),
    ('spawn_npcs', {}),
]

for typ, payload in actions:
    r = c.post('/api/action', headers=h, json={'type': typ, 'payload': payload, 'nonce': f'{typ}-{uuid.uuid4()}'})
    assert r.status_code == 200, (typ, r.text)

fresh = c.get('/api/state', headers=h).json()
assert len(fresh.get('npc_activity', [])) > 0
assert len(fresh.get('market_history', [])) > 0
assert any(x['code'] == 'chemicals' for x in fresh['market'])
assert any(x['code'] == 'bio_gel' for x in fresh['market'])
assert any(x['code'] == 'volatile_reagents' for x in fresh['market'])

# Non-god live account should exist and have normal progression constraints.
live_h = login('pilot', 'pilot123')
live = c.get('/api/state', headers=live_h).json()
assert live['user']['god_mode'] is False
assert live['player']['level'] == 1
assert live['player']['credits'] < fresh['player']['credits']

print('SMOKE OK')
