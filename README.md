# Facebook Comment Reader

A mobile-friendly continuous text-to-speech reader for the public [Paintwitheroy post](https://www.facebook.com/61591138393698/posts/122127670083371279/).

Paste or drop any Facebook post URL into the link field. Each post gets its own comment queue and its own browser-stored imported comments. The example post below is the only one with a bundled comment snapshot. A URL alone cannot provide comments for other posts because the public Facebook page response does not expose them; open the post and paste its comments into the reader. The app does not claim automatic retrieval for those links.

The app captured 735 distinct Facebook entries on 8 November 2026. It plays 667 unique text comments and replies after removing 68 repeated texts (ignoring case, spacing, and punctuation). The original capture is in `data/comments-raw.json`. Facebook showed 983 in its comment counter, but the remaining entries were not verified or included. Emojis are omitted from displayed and spoken text. New comments are not fetched automatically.

The phone page includes its first 30 comments in the HTML, so playback can begin as soon as the page opens. It buffers the other 637 saved comments in the background and continues playback as they arrive. Paste additional comments, one per line or as a JSON array, to add them to the listening queue without stopping playback. Duplicates are skipped. Pasted comments are saved in this browser's local storage and restored after a refresh.

A progress bar beside the link field shows how many saved comments are ready and the progress of a pasted batch. For other Facebook links, it immediately shows that no comments are available from the link alone.

Audio uses the browser Speech Synthesis API. Keep the page open while listening.
Commenter names are not displayed or spoken.

Deploy with `npm install` and `npm run deploy`.

Run `python build_reader.py` after editing `reader.js` or the comment data. Set `INLINE_READER_PATH` to also update the Codex in-chat fragment.

