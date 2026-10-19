# Project Architecture Rules

- Biometric ADMS requests must preserve each idempotent raw punch for admin review and must never create or change attendance records automatically, because attendance decisions remain an explicit admin action.
- ADMS request diagnostics are stored as bounded redacted metadata on admin-only event records; credentials and unredacted request bodies are never captured, so support can inspect traffic safely.