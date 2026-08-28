# 02 — DESIGN SPEC

Direction: **Mark and Sweep**. Chosen by Saharsh from three built previews, after a judging
workflow scored it 8.5 on "does this feel alive" and 8.5 on "does this get him hired", the only
direction to win both.

## The idea

There are 421 blocks lying on the floor of the page. 421 is not a design number. It is the exact
count of memory allocations removed in `kubernetes-sigs/resource-state-metrics` pull request 102,
down to 2. The floor of the site is that commit.

You can shove the pile with the cursor, grab a block and throw it, flip gravity in four directions,
and press `g` to run the garbage collector, which sweeps 419 away and leaves 2 behind.

**Two blocks never sleep.** Every other block settles and stops. Those two oscillate about half a
pixel forever. Nothing on the page says why. They are the 2 allocations that survived.

## The rule that makes it defensible

**Spectacle and evidence are architecturally separate.**

Every route is statically generated. The headline, all prose, every benchmark, every pull request
link, and all three competitive programming profiles are in the server HTML at full opacity with no
entrance animation. Nothing fades in.

The physics is imported inside a `useEffect`, so matter-js lands in its own chunk and loads after
first paint. Turn JavaScript off and you lose the toy, not the argument. Verified: 1,188 readable
words and all 21 pull request links survive with every `<script>` stripped.

This is what lets the site be loud without refuting a performance engineer.

## Ground and palette

Warm concrete. Not near black, not the cream cluster, not white. A mid tone ground is the unusual
choice: it lets blocks read both lighter and darker than the floor, which a white or black page
cannot do.

| Token | Hex | Notes |
|---|---|---|
| Concrete | `#ABA89A` | the ground |
| Chalk | `#EFEBDC` | every raised surface |
| Ink panel | `#1B1A15` | terminal output only, never full bleed |
| Ink | `#16150F` | 7.66:1 on concrete |
| Ink 2 | `#3E3B31` | 4.69:1 on concrete |
| Ultramarine | `#2A2BD6` | large text and non text only. **3.64:1 on concrete, fails AA at small sizes** |
| Ultramarine deep | `#1D1F96` | small text on concrete, 5.21:1 |
| Cadmium | `#F2C300` | the gravity control when active |
| Rust | `#A8341C` | 5.54:1 on chalk |
| Moss | `#2F6B3A` | 5.35:1 on chalk, the merged label |

Ultramarine and cadmium on concrete is Bauhaus and industrial signage, not a tech palette.
**No gradients anywhere. No blur glow, no glass, no shadows, no rounded cards.**

The only texture is 128px of monochrome noise generated in the browser at `mix-blend-mode: soft-light`,
opacity 0.34. Nothing is downloaded for it.

## Type

**Go Mono** is the voice. Display, every number, every label, all terminal output. Made by Bigelow and
Holmes for the Go project, BSD licensed. It is **not on Google Fonts**: the 173,248 byte original comes
from `go.googlesource.com` and is subset here to **10,756 bytes** of woff2, with bold as a real second
file at 10,996 bytes, because faux bold on a monospace face is visibly wrong.

**Archivo** carries prose only, through `next/font/google`, self hosted at build.

The prose face is the quiet one and the mono is the voice. That inversion is correct for a person
whose evidence is terminal output.

## The five defects the audit caught, all fixed

1. **Contrast.** The instruction line was specified as ultramarine on concrete, 3.64:1, failing AA,
   and it is the only sentence telling a visitor the page is interactive. It now sits on a chalk chip
   at 15.32:1, with ultramarine used only on the words it points at, where it is 7.28:1.
2. **The cursor.** Specified as a static body moved with `setPosition`, which carries no velocity into
   the solver, so fast moves tunnel straight through blocks. It now carries `setVelocity` from a three
   frame rolling average, so a flick shoves and a flick throws.
3. **Rotation.** A sixteen bucket sprite atlas gives 22.5 degrees of granularity, and blocks settling
   at arbitrary angles visibly snap between buckets. Drawn per body instead.
4. **Touch.** A canvas that answers drags in the bottom band steals the thumb scroll zone. On coarse
   pointers the pile is **not interactive** and the count drops to 150.
5. **Gravity needs a ceiling**, or upward gravity throws the commit off the top of the screen forever.
   The ceiling exists but is switched off for the first 2.6 seconds so the opening rain still lands.

Also: sleeping bodies ignore a gravity change entirely, so every block is woken and nudged loose when
a direction is pressed.

## Behaviour floor

- **JavaScript off**: complete and readable. The floor is simply empty.
- **`prefers-reduced-motion: reduce`**: the heap never initialises at all.
- **Coarse pointer**: blocks fall and settle, gravity still works, nothing is grabbable.
- **Tab away**: the loop parks on `visibilitychange`.
- Honest note: the two survivors never sleep, so the loop does run while the tab is visible. The cost
  is about 0.27ms per step with everything else asleep.
