# Project Architecture Rules

- Biometric ADMS requests must preserve each idempotent raw punch for admin review and must never create or change attendance records automatically, because attendance decisions remain an explicit admin action.