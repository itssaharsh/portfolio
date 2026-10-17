# itssaharsh.vercel.app

Saharsh Tibrewala's portfolio, live at [itssaharsh.vercel.app](https://itssaharsh.vercel.app).

The floor of this site is 421 blocks. That is the exact number of memory allocations a single
run used to make, before
[kubernetes-sigs/resource-state-metrics#102](https://github.com/kubernetes-sigs/resource-state-metrics/pull/102)
brought it down to 2. Push them around. Press `g`.

Next.js 16 · React 19 · Tailwind 4 · Neon · matter-js · Go Mono, subset by hand.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

The site works without a database. The blog shows an empty state and the writing desk explains what is missing.

## Putting it live

Full walkthrough in [`SETUP.md`](SETUP.md). The short version:

1. Create a Neon project, run `db/schema.sql` in its SQL editor.
2. Run `db/seed.sql` to put the first post in.
3. Import the repo on Vercel with the values from `.env.example`, set on the import screen.
4. Add a public Blob store, then redeploy so the token is picked up.
5. Go to `/admin`, sign in with your password, and write. Drag an image straight into the text.

## Posting from a text file

```bash
./post notes.txt               # publish it
./post notes.txt --dry-run     # show what would be posted, and post nothing
./post notes.txt --draft       # save it where only the writing desk can see it
npm run post notes.txt         # the same through npm, where flags need a double dash first
```

The first line of the file is the title. Blank lines separate paragraphs. A short line standing
alone, starting with a capital or a number and not ending in punctuation, becomes a heading. Anything already written
as markdown is left alone. Lines straight under the title can say `tags: go, opentelemetry`,
`summary: ...` or `draft: yes`. The full rules are at the top of `scripts/post-text.mjs`.

Keep those setting lines together, straight under the title, with no indent in front of them.
When the command finds one out of place at the top of the file, it stops and shows the line
instead of publishing it as text. A `draft: yes` with a blank line between it and the other
settings is found that way. So is one under a summary that wrapped onto a second line, and one
pushed in by the tab key. A first line that is itself a setting stops it too, because the first
line is the title.

Run it again on the same file and the post it made is updated. It remembers which address a
file last posted to, on this machine, so a corrected title updates that post too.

It looks before it writes. It changes a post only when the file is plainly a version of it:
most of the old text is still there under the same title, or, under a new title, nearly all of
each text is in the other. It makes a new post only when the file is plainly new. When it cannot
tell, it stops, says what it found, and asks. A rewrite that keeps less than half of a post is
one such case, and so are next week's notes under last week's title. So is any change to a post
of under about thirty words, which is too little text to be sure of. You answer with one flag:

```bash
./post notes.txt --same-post    # it is that post. change it where it is.
./post notes.txt --separate     # it is a new post. put it beside the one that looks like it.
./post notes.txt --overwrite    # it is a different post. replace the one at that address.
```

It leaves a draft a draft unless you add `--publish`, and a live post live unless you add
`--draft`. The exceptions are `--overwrite`, which puts a new post where another was, so it is
published unless the file says `draft: yes` or you add `--draft`, and the undo of an overwrite,
which puts the old post back in place of whatever is at its address now, as a draft unless it
was live then and the address is live now. It leaves alone a summary it would not have cut itself.
And it keeps whatever it replaces in `.post-backups/`, as a file you can post back. Posting a
copy back never makes anything live by itself.

After a change the command prints the line that puts the old version back. When the run changed
whether the post is out, that line carries `--publish` or `--draft`, because a copy never
changes that by itself. One thing stays: a post that had no date is given one the first time it
goes out, and the site keeps it after the post is put back. The command says so when that
happens.

It warns about dashes and doubled words before it sends anything. It needs `ADMIN_PASSWORD` in
`.env.local`, the same password that opens `/admin`, and it never touches the database itself.

`npm test` runs the command against the real `/api/posts` code in memory, with a JSON file for
a database and no network, so it can be changed without going near the live blog. It also tries
every combination of inputs the command's decision can be given, about 94,000 of them, and
types back every answer the command offers to see that it is taken. `npm run fuzz` throws
random sequences of commands at the same in memory site, answers the questions the command asks
with the answers it printed, takes the way back it prints, and checks that nothing was
published, taken down, turned into another post or put up twice that no flag asked for.

`npm test` runs the writing desk's own code the same way: saving, deleting, the sign in check
and what each page of the desk draws. `npm run desk` runs the editor itself in a headless
Chromium with no server, one test for each way it once lost text or changed whether a post was
live. It needs Playwright, which is not a dependency of the site. It looks in the folder named
by `PLAYWRIGHT_FROM`, then in `node_modules`, then in what `npx playwright` has left in npm's
cache. When it finds none it skips every test and says how to get one.

## Keeping the facts true

```bash
npm run facts    # asks GitHub whether every pull request still matches content/data.ts
```

Pull requests get merged and closed without telling this repo. Run this before trusting a label.
It checks whether each one is merged or open, the dates, and the count of lines added and
removed. It cannot check benchmark figures. A person reads those from the pull request.

## Rules this repo keeps

Every fact on the site comes from [`content/data.ts`](content/data.ts). Nothing may assert anything
that is not in there. Two claims that were once on the resume are wrong and are deliberately not
repeated: collector-contrib 46819 is closed rather than merged, and SeedSigner 916 and 927 are
still open.

Prose carries no dashes and no jargon. Repository names, URLs and benchmark output keep their real
characters, because changing those would break links and misname real projects.

## Rebuilding the resume

```bash
npm run resume    # resume.tex -> public/resume.pdf
```
