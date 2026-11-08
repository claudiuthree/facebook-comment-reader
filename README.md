# Facebook Comment Reader

A mobile-friendly continuous text-to-speech reader for the public [Paintwitheroy post](https://www.facebook.com/61591138393698/posts/122127670083371279/).

The app captured 735 distinct Facebook entries on 8 November 2026. It plays 667 unique text comments and replies after removing 68 repeated texts (ignoring case, spacing, and punctuation). The original capture is in `data/comments-raw.json`. Facebook showed 983 in its comment counter, but the remaining entries were not verified or included. Emojis are omitted from displayed and spoken text. New comments are not fetched automatically.

Audio uses the browser Speech Synthesis API. Keep the page open while listening.

Deploy with `npm install` and `npm run deploy`.

