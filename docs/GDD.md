# Game design document — MVP

## Core loop

Choose language → explore a compressed Da Nang map → talk to the currently available NPC → complete deterministic mini-game → receive one Memory Fragment/postcard → use unlocked locations in a safe itinerary.

## Quest table

| Quest            | Gameplay                | Win                                    | Learning message                                |
| ---------------- | ----------------------- | -------------------------------------- | ----------------------------------------------- |
| Dragon Bridge    | Rhythm lights           | At least 7/10 within 60 s              | Landmark on the Hàn River.                      |
| My Khe           | Collect 8 litter pieces | All 8 within 60 s                      | Keep beaches clean.                             |
| Marble Mountains | Connect five elements   | Correct complete sequence, max 3 hints | Caves, pagodas and stone-carving context.       |
| Son Tra          | Observe 3 traces        | All three traces                       | Observe wildlife without chasing or feeding it. |

## Accessibility baseline

WASD/arrows, E/Space, Escape, touch joystick and touch interaction are supported. Visual feedback is sufficient for every mini-game. React modals use focus initialization, cyclic Tab and Escape close; controls have labels/focus styles. Responsive target sizes are 1366×768 and 390×844.

## Out of scope

Combat, multiplayer, economy, crafting, inventory complexity, procedural world and real-scale Da Nang map are deliberately excluded from the MVP.
