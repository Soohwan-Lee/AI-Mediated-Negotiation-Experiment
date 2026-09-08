# Negotiation turn recovery verification

Verified on 2026-09-08 for Direct negotiation and the Proxy closing conversation.

- Classification and counterpart requests make at most three attempts, with a 20-second timeout per attempt and short bounded backoff.
- A failed turn retains the original message, package, send time, and successful classification. Retry does not consume another message, disclosure, event, or state-machine turn.
- The negotiation clock starts pausing on the first detected technical failure. It stays paused through automatic and manual recovery, then resumes after the full turn succeeds. One `technical_pause` event records the elapsed pause.
- A turn submitted before zero is allowed to resolve. If it does not settle the negotiation, the deferred timeout ends it immediately after that turn commits.
- Unmount and terminal guards abort active requests and prevent late state or persistence writes.

Browser checks covered three classification failures followed by manual success, and classification success followed by three counterpart failures and manual success. Direct and Proxy closing each committed exactly one participant message and one counterpart reply. The counterpart-failure retry reused the cached classification and identical request snapshot.

An AI-Supplemented closing check also submitted an accepted package with two seconds left and crossed zero during the normal reply delay. It produced one agreed ending, preserved the accepted package, and produced no timeout ending.

A Direct check submitted an SB-labelled full package with two seconds left, entered recovery, and then succeeded through Retry. It produced exactly one accepted ending and one participant transcript row.

Full-page refresh hydration, Supabase integration, and identity recovery remain outside this change.
