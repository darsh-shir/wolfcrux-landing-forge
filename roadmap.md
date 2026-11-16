# Attendance integration

- [x] Preserve ADMS punches as review-only; disable punch-driven attendance writes.
- [x] Add admin view of recent punches and dated IST shift-start settings.
- [x] Add admin-only redacted ADMS request diagnostics and a no-attendance connectivity probe.
- [x] Create/attach the attendance relay Worker and DNS route after explicit confirmation.
- [x] Verify Worker forwarding, HTTPS, GET handshake, POST query/body preservation, and edge-function receipt through the public relay. Admin-authenticated connectivity probe remains unavailable until an admin session is active.
- [ ] Confirm K90 Pro HTTPS support and accepted secure port before changing its current device settings.
- [ ] Capture the real device serial/request and register it before verifying a real punch; no real K90 request has been received.