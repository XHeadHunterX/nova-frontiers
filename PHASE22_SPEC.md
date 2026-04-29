# Phase 22 Implementation Notes

Goal: make Nova Frontiers' map layer feel alive, readable, interactive, and time-based.

Core rules implemented:

1. Map UX
- The map uses a large viewport.
- Drag pans the world.
- Mouse wheel zooms.
- Buttons support zoom in, zoom out, and reset.
- Bounds are clamped so content cannot disappear permanently.
- Detail panels are separate from the map and do not overlap the action popup.

2. Right-of-Mouse Action Popup
- First click only opens a contextual popup.
- Actions require explicit selection.
- Blank space supports Go Here.
- Planet/station nodes support Inspect and Travel Here.
- NPC ships support Inspect, Intercept, Attack, and Follow.
- Ore signatures support Inspect Ore and Mine.
- Salvage wrecks support Inspect Wreck and Salvage.
- The popup opens slightly to the right of the pointer and closes when clicking elsewhere.

3. Live Travel Simulation
- Player travel is timestamp based.
- NPC travel is timestamp based.
- Frontend renders moving ships by interpolating from backend start/end coordinates and start/arrival times.
- Arrival is resolved server-side during state reads.

4. Cargo Timers
- Loading and offloading create backend cargo_timer records.
- Travel, mining, salvage, and combat are blocked while loading/offloading.
- Cargo completion is resolved server-side.
- The UI shows operation progress.

5. Security Response
- Planet security controls patrol response.
- Attacking/intercepting in secure systems has higher consequences.
- Loading/offloading protects the player from attacks.

6. NPC Simulation
- NPCs travel between worlds.
- NPCs trade, mine, patrol, pirate, and haul.
- NPC activity can alter market stock.
- NPC combat sometimes creates salvage.
- Ore and salvage can legitimately return 0.

This build is a local standalone recovery package, not the exact inaccessible artifact from the prior chat.
