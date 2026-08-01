# Tuner — the three flows to fix

Paste this into Claude Code alongside `README.md`. These are UX flows, not styling: they decide whether someone finishes a dash or gives up.

---

## Flow 1 — Bind a signal without leaving the canvas

**Problem today.** Widgets are placed in the editor, but a widget's signal is chosen from a dropdown that lists names the user has not created yet. The CAN table lives in another view. So the real sequence is: scan → memorise an ID → switch view → place a widget → hunt for the signal in a list. That break is where people give up.

**Proposal.** The Signals list becomes a permanent, draggable panel in the editor (third tab of the inspector, already drawn), fed live by the scan.

1. Scan runs in the background from any view. The Signals tab shows every bound signal plus every unbound ID still arriving, with its live value.
2. **Drag a signal onto the canvas** → creates the default widget for its type (numeric for a scalar, gear for an enum, warning if the signal has a threshold in the profile) already bound.
3. **Drag a signal onto an existing widget** → rebinds it. The widget flashes its border for 200 ms so the change is visible.
4. **Drag a widget from the Library onto a signal row** → same result, other direction.
5. A widget with no signal renders `- -` on the canvas and is listed in a "3 unbound" counter in the toolbar. Burning with unbound widgets asks for confirmation once.

**Bonus that costs little.** In the CAN table, a "learn" mode: press Learn, do the thing in the car (rev it, press the clutch, turn the wheel), and the table sorts by which IDs changed the most in that window. That is how people actually reverse-engineer an unknown bus.

**Done when** a user who has never opened the docs can go from a fresh scan to a bound gauge in under a minute, without changing view.

---

## Flow 2 — Projects, cars and presets

**Problem today.** There is one implicit project. Someone with two cars, or a tuner shop with twenty, has nowhere to put them, and nothing to copy from.

**Proposal.** A `Project` is the unit that gets burned: pages + widgets + ECU profile + theme + target panel.

- **Project switcher** in the header, next to the name. Lists recent projects, `New project`, `Duplicate`, `Import .canshift`, `Export .canshift`.
- **New project wizard, three steps, no more:** target panel → ECU profile (or "scan and I'll help") → starting point (blank, or one of the six default page sets).
- **A project is one JSON file** (`.canshift`) holding everything but the firmware binary. Import and export are one click, so a shop can hand a customer their dash, and the community can share layouts.
- **Device ↔ project link.** On connect, compare what is on the panel with the open project: identical, project is newer, device is newer, or different project. Say which, and offer `Pull from device` — someone who lost their file can always get it back from the car.
- **Page templates** rather than only whole projects: right-click a page → `Save as template`, and it shows up in the new-page menu.

**Done when** a user can hold two cars in the app, duplicate one page from the first into the second, and export the whole thing as a file they can email.

---

## Flow 3 — Undo, and never lose work

**Problem today.** No undo. On a canvas where dragging is the main verb, that is the single scariest thing in the app — it makes people hesitate before every action, which is exactly what a design tool must not do.

**Proposal.**

- **A real undo stack, 100 steps, `⌘Z` / `⌘⇧Z`**, covering: move, resize, add, delete, rebind, page add/delete/reorder, theme change, target-screen change. Not covered: scan results, connection state.
- Each undoable action gets a short label so the History panel can read `Moved gauge.rpm`, `Bound ecu.oilPress`, `Deleted page 05` — and clicking an entry jumps back to that state.
- **Autosave to local storage on every mutation**, with the header showing `saved 2 s ago` instead of the current `3 unsaved changes`. Reopening the tab restores the exact canvas, including the selection.
- **Destructive actions never need a modal.** Delete a page, get a toast with `Undo` for 8 seconds. That is faster than a confirmation dialog and safer, because it also covers the deletions people meant to do but got wrong.
- **The one place a confirmation is right** is `Burn` — it is the only action that leaves the browser and touches the car.

**Done when** every action on the canvas is reversible, nothing is ever lost by closing the tab, and no dialog stands between the user and an edit.

---

## Suggested order

1. Undo + autosave (Flow 3). It removes the fear, and everything else gets easier to build on top.
2. Drag-to-bind (Flow 1). It is the moment the product clicks.
3. Projects (Flow 2). It is what makes it usable by more than one car.

## Issues to open

- `tuner/flow`: Signals panel in the inspector, fed by the live scan
- `tuner/flow`: Drag a signal onto the canvas creates a bound widget
- `tuner/flow`: Drag a signal onto a widget rebinds it, with a 200 ms flash
- `tuner/flow`: Unbound widgets render `- -` and are counted in the toolbar
- `tuner/flow`: CAN table "Learn" mode — sort by what changed in the last window
- `tuner/flow`: Project model — pages, widgets, profile, theme, target as one unit
- `tuner/flow`: Project switcher in the header, with duplicate / import / export
- `tuner/flow`: New-project wizard, three steps
- `tuner/flow`: `.canshift` file format, import and export
- `tuner/flow`: Compare device against open project on connect, offer Pull from device
- `tuner/flow`: Page templates, saved from any page
- `tuner/flow`: Undo stack with labelled actions and `⌘Z` / `⌘⇧Z`
- `tuner/flow`: History panel, click to jump to a state
- `tuner/flow`: Autosave to local storage, `saved N s ago` in the header
- `tuner/flow`: Undo toasts replace confirmation dialogs, except for Burn
