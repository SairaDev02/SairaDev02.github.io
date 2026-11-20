# Drop the play model: opening is the only action

Status: accepted (spec: issue #58)

## Context

The home page framed each public repository as a disc in a CD player picture, with a track list, a now-playing Dock (Lyrics, Queue) and a 30 s "play" that began when a repository opened. The state behind it had a Cue, a Queue, Shuffle, a Load, an Eject, a Return and a clock.

The owner retired the music framing. The model also had no meaning outside the metaphor: a visitor wants to see the repositories, find one and open it, and the extra controls and states did nothing for that. The same repository showed in up to five places at once (picture, faceplate, Dock, row, Queue), and the CPU-drawn picture kept the main thread about 51% busy once it ran, on a throttled phone profile.

## Decision

Remove the play model: the CD player picture and faceplate, the Dock with Lyrics and Queue, the player state and its clock, the README-to-lyrics parsing, the playlist header's Play and Shuffle, and the sky.

Opening becomes the only action. A plain click or Enter on a board row opens the repository in a new tab at the gesture (`window.open`, null check, then `opener = null`). The Asset is marked Opened for the visit, in memory, like a visited link, and the page's one polite status announces it. A blocked tab announces how to open it and marks nothing. Previewing an Asset (pointer or focus on a row) changes nothing but the row's and, later, the view's styling.

All music wording goes with it: the page title and description, the 404 page, `llms.txt` and the structured data.

## Consequences

- Less state and fewer controls: one route to open (`src/scripts/open.ts`) and one Preview (`src/scripts/preview.ts`) replace the player state.
- A repository appears in two places, the board and (in a later slice) the sensor view, instead of five.
- The playful music metaphor, which the owner chose to retire, is lost. Opening a repository no longer has a visible duration or a result beyond the Opened mark.
- READMEs are no longer fetched at build time: the build makes fewer GitHub API calls.
- The CPU picture renderer stays only as far as the dev-only link preview card route (`/og-card`) imports it.
