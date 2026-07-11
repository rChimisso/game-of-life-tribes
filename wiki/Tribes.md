# Tribes

## Purpose

The Tribes section edits the named cell states used by drawing, rules, bounded-grid boundaries, rendering, snapshots, and exports. Every ruleset includes the special `dead` tribe for empty cells; the UI only lists editable non-dead tribes. For the persisted tribe JSON shape, see [Tribe JSON](Rule-Expressions#tribe-json).

## Controls

- **Add tribe**:  
  Opens the add editor with an empty name and random color.
- **Tribe row swatch**:  
  Shows the current tribe color.
- **Tribe row name**:  
  Shows the current tribe ID.
- **Edit**:  
  Opens the editor for an existing tribe. When editing, the same button becomes the confirm button.
- **Discard**:  
  Closes the editor and restores the current tribe values.
- **Remove**:  
  Removes the tribe from the tribe list.
- **Name**:  
  Alphanumeric tribe ID input.
- **Palette swatches**:  
  Quick color choices.
- **Random color**:  
  Chooses a random RGB hex color.
- **Hex input**:  
  Six-character RGB hex color, without `#`.
- **Native color picker**:  
  Browser color picker synchronized with the hex input.
- **Add**:  
  Confirms a new valid tribe.
- **Cancel**:  
  Closes the add editor.
- **Apply**:  
  Commits tribe changes to the ruleset. Disabled while running, downloading, unchanged, empty, editing a tribe, or blocked by rule or active bounded-boundary references.
- **Restore**:  
  Discards tribe changes and restores previously committed tribes.

## Validation

A tribe ID must be non-empty, unique, alphanumeric, and cannot be `dead`. Colors must be six hex characters.

Removing a tribe can be blocked if committed rules still reference it, or if it is the active boundary tribe while the grid topology is bounded. If both conditions apply, the UI shows separate boundary and rule messages.

Renaming or recoloring a tribe updates references in committed rules and the boundary tribe setting when the change is applied.
