Someone asked me what I actually work on, and I said OpenTelemetry, and they nodded in the way people nod when they have decided not to ask a second question. So here is the answer I should have given.

## Start with a lost parcel

You order something. It does not turn up. You ring the company and ask where it is.

If they are any good, they can tell you: it left the warehouse on Tuesday, reached the sorting centre that night, sat there for two days because of a backlog, went out on a van this morning, and the driver could not find your building. Every stop along the way, somebody scanned it, and those scans add up to a story.

If they are not any good, they say "it has been dispatched" and that is the whole story. The parcel went into a box and something happened and now you are cross.

Software has exactly this problem, and it is worse, because a single click on a website can touch thirty different programs owned by four different teams before anything appears on your screen.

## So what breaks

When a page is slow, the honest answer is usually nobody knows why. Not because the engineers are careless, but because each of those thirty programs only sees its own small part. Each one thinks it did fine. The program that took eleven seconds does not know it was the one holding everyone else up, and the program that got blamed was just waiting.

You end up with four teams all looking at their own dashboard, all of which say green.

## What OpenTelemetry is

It is the agreement about how to scan the parcel.

That is genuinely it. It is a shared way for every program to say: I picked this up at this moment, I did this to it, I handed it on at this moment, and here is the tag that ties my scan to everyone else's.

Two parts matter.

The first is the tag. Every request gets a small label, and every program passes that same label along to whatever it calls next. Afterwards you can collect every scan carrying that label and lay them out in order, and there is your story. Left the warehouse Tuesday. Sat for two days. That is the bit that was slow.

The second is that it is shared. Before this, every company that sold monitoring had their own way of doing the scanning, and if you switched, you rewrote everything. OpenTelemetry is the industry, including the companies who sell you the monitoring, agreeing on one format so you stop being stuck. It finished graduating from the Cloud Native Computing Foundation in May 2026, which is the point where enough serious people are relying on something that it stops being somebody's project and starts being infrastructure.

## Where I come in

I do not build the interesting parts. I work on making the scanning cheap.

Here is the thing about that label. It gets read on every single request. Not every slow request, not every failing one. Every one. If your service handles fifty thousand requests a second, that label gets read fifty thousand times a second, forever, on every machine you own.

So the code that reads it is worth being annoying about.

It used to read the label twice. Once to check the characters were all valid, then again to actually pull the numbers out. Two passes over the same short string. Perfectly sensible, and how most people would write it.

I made it do both at once, by looking each character up in a small table that says both "is this valid" and "what number is it" in one go. About a tenth off the time it takes, every time, everywhere.

Then there was a second one. When a computer reads a piece of a list, it normally checks first that the piece it is about to read actually exists, because reading past the end of something is how programs crash. Sensible. But if you write the code so the compiler can see for itself that you never go past the end, it stops writing those checks, because it can prove they will never fire. I rewrote the reading so it could prove that. Twelve checks it no longer has to write. A third off, and nothing extra asked from memory.

Neither of these is clever. There is no insight in them. They are both just somebody sitting down and reading the same forty lines about nine times.

## Why bother

Because it runs everywhere.

If I make my own project a third faster, I have made my own project a third faster. If I take a tenth off this, it comes off every request going through every service that uses it, at every company that installed it, for as long as the code lives. I will never meet those people and they will never know. That is the appeal.

There is also the smaller and more honest reason, which is that I like this kind of problem. The whole thing is already written, already correct, already reviewed by people better than me. The only thing left is to make it cost less. There is a right answer, you can measure whether you found it, and the measurement does not care whose idea it was.

## If you want to look

Both of the changes above have since been merged, on 7 and 21 September 2026, after review by the people who maintain the project. Review is where I get told what I have missed, which happens, and which is most of how I have learned anything.

- [Reading the label in one pass](https://github.com/open-telemetry/opentelemetry-go/pull/8739)
- [Letting the compiler drop the checks](https://github.com/open-telemetry/opentelemetry-go/pull/8740)

The numbers in both are from twelve runs each, and the command to reproduce them is in the description. Do not take my word for any of it.
