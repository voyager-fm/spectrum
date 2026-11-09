# ChangeSet contract
A proposal identifies its base repository revision, exact proposed edits, and each original file hash. Approvals must bind to the exact proposed content digest, actor and timestamp. Recheck the current revision and every file hash before applying; stale proposals return to review. No automatic merge, push or external publication.

Current TypeScript types and assertPublishable cover only part of this contract. Digest-bound approval storage, hash verification, transactional writes and publishing remain unimplemented.
