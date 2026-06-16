# Learning Loop and Compounding Feel

You are working in the Carina core codebase. Make the learning loop feel immediate, visible, and compounding in real use.

Product goal:
- the user corrects Carina once
- the next run is better
- the third run is automatic
- the system never silently throws away useful corrections
- archival remains intact and searchable

Why this matters:
- This is the moment where Carina stops feeling like a chatbot and starts feeling like a system that improves with the user.

Scope:
- correction capture
- preference learning
- quality gating
- archival and never-delete behavior
- cross-session recall
- session search quality
- learned preference visibility
- operator diagnostics for learning state

Requirements:
- Review the current learning loop end to end.
- Make correction detection reliable and explicit.
- Ensure learned preferences are applied on the next relevant run.
- Keep archival history intact, versioned, and traceable.
- Prevent low-confidence corrections from degrading good behavior.
- Expose a clear GUI or operator view of what was learned and why it was accepted.
- Add tests for first correction, repeated correction, ignored correction, archive promotion, and rollback.

Implementation notes:
- Measure the delay between correction and future recall.
- Make the system explainable enough for operators to debug it.
- Prefer evidence-backed promotion over automatic overwrite.
- Keep local and hosted behavior aligned.

Acceptance criteria:
- A user can see that corrections matter.
- The second and third attempt feel better than the first.
- Nothing important is lost when the loop updates itself.

