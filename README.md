# Facebook Comment Reader

Live reader: https://comments.claudiuone.workers.dev/. The previous `facebook-comment-reader.claudiuone.workers.dev` address and its unexpired share links remain available. Browser-saved queues belong to each address separately; open an existing share link on the new address to load that queue there.

A mobile-friendly continuous text-to-speech reader for the public [Paintwitheroy post](https://www.facebook.com/61591138393698/posts/122127670083371279/).

Paste or drop any Facebook post URL into the link field. Each post gets its own comment queue and its own browser-stored imported comments. Three Paintwitheroy posts have bundled comment snapshots, including the [painter advice post](https://www.facebook.com/paintwithroy/posts/pfbid0od9Npj8uWk2zFGYUK1FqQKVE8AvNg4fYbFGJ2DVonBmEeqa22NBnRwDKpbxdW1T5l) and the [gloves post](https://www.facebook.com/paintwithroy/posts/pfbid08vzD1LjCHTvwQZE3mHvBKU6mCY8MCWSgh5ANFMMFPN7vZVg6fxq7BoYpVxs2pe7Dl). For new posts, the Windows Chrome mini player in `extension-clean/` reads and plays visible comments on the Facebook post. It can copy a text queue for import into the reader and phone sharing. Setup instructions are at `/collector-setup.html`. The collector depends on Facebook's page layout and may not capture every comment or reply.

On a Facebook post in Windows Chrome, press the extension icon and **Collect and play**. The extension opens a small on-page player with a loaded count and Previous, Play/Pause, Next, and Stop controls. A **Comment reader** button also appears on post pages so the controls can be reopened. The on-page player speaks comments as they buffer; the full reader site is only needed for phone sharing or saved queues.
Drag the player by its top bar to move it. Drag its lower right corner to resize it. The size and position are remembered on Facebook.
The mini player ZIP omits the previous background tab automation after Microsoft Defender flagged that script. A later smaller build was needed because Defender also blocked the first mini package on download. The current package was locally scanned with Defender but has not yet been confirmed as downloadable in Chrome. It does not open or close Facebook tabs from links pasted into the reader. The earlier full extension source remains in `extension/` for review, but its ZIP is no longer distributed.

The app captured 735 distinct Facebook entries on 8 November 2026. It plays 667 unique text comments and replies after removing 68 repeated texts (ignoring case, spacing, and punctuation). The original capture is in `data/comments-raw.json`. Facebook showed 983 in its comment counter, but the remaining entries were not verified or included. Emojis are omitted from displayed and spoken text. New comments are not fetched automatically.

The phone page includes its first 30 comments in the HTML, so playback can begin as soon as the page opens. It buffers the other 637 saved comments in the background and continues playback as they arrive. Paste additional comments, one per line or as a JSON array, to add them to the listening queue without stopping playback. Duplicates are skipped. Pasted comments are saved in this browser's local storage and restored after a refresh.

A progress bar beside the link field shows how many saved comments are ready and the progress of a pasted batch. Without the collector, new links immediately show that no comments are available from the link alone.

The Activity log at the bottom records link selection, saved snapshot loading, Chrome collection, pasted comment imports, timeouts, and errors. It says when the collector is not connected.

The Copy diagnostic report button copies the selected post URL, ready count, progress, and recent activity. A user can paste that report into the Codex chat for link-specific troubleshooting; the site does not send the report automatically.

Audio uses the browser Speech Synthesis API. Keep the page open while listening.
Commenter names are not displayed or spoken.

The **Send this queue to my phone** button stores a text-only queue in Cloudflare KV for 24 hours and gives an unguessable link. Anyone with that link can listen to its comments until it expires. The share endpoint limits posts to Facebook URLs and queues to 1,000 comments and 200 KB. The collector itself only sends text from Facebook to the reader tab; the phone share happens when the user presses its button.

The painter advice snapshot was captured from visible Facebook comments on 8 November 2026. Facebook displayed 189 comments, including replies; the saved snapshot is a partial set of visible top-level text comments, with repeated text removed. The reel URL `https://www.facebook.com/reel/1765689758066750` is a separate post with its own comments.

The gloves post snapshot was captured on the same date and contains 14 visible text comments. Facebook showed 21 comments including replies, so this is a partial set.

Deploy with `npm install` and `npm run deploy`.

After changing the unpacked extension, reload it in `chrome://extensions` so the new reader address is connected.

Run `python build_reader.py` after editing `reader.js` or the comment data. Set `INLINE_READER_PATH` to also update the Codex in-chat fragment.

