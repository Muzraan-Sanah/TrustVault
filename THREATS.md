# TrustVault — Security Threat Model

## 1. Project Overview
TrustVault is a secure document-sharing application designed to prevent unauthorized document access and maintain an audit trail.

## 2. Assets to Protect
- User accounts and personal information
- Password hashes and authentication tokens
- Uploaded documents
- Document ownership and sharing permissions
- Audit logs
- Database credentials and application secrets

## 3. Security Threats and Mitigations

### Threat 1: Unauthorized Access
**Risk:** Unauthenticated users may attempt to access protected endpoints.
**Mitigation:** Require valid authentication tokens and reject unauthorized requests.

### Threat 2: Unauthorized Document Access
**Risk:** Users may attempt to access another user's private documents.
**Mitigation:** Verify document ownership or granted permissions on every document operation.

### Threat 3: Improper Document Sharing
**Risk:** Documents may be shared with unintended recipients.
**Mitigation:** Validate recipient accounts and enforce sharing permissions on the server.

### Threat 4: Revoked Permission Abuse
**Risk:** A recipient may try to access a document after their permission is revoked.
**Mitigation:** Check current permissions whenever a document is accessed or downloaded.

### Threat 5: Malicious File Uploads
**Risk:** Unexpected or oversized files may be uploaded.
**Mitigation:** Validate file types and sizes, generate safe filenames, and store files securely.

### Threat 6: Password and Token Compromise
**Risk:** Weak password handling or exposed tokens may compromise accounts.
**Mitigation:** Hash passwords, protect authentication secrets, and avoid exposing tokens in logs.

### Threat 7: Audit Log Tampering
**Risk:** Security events may be omitted or audit records manipulated.
**Mitigation:** Generate audit records on the server and restrict access to audit logs.

### Threat 8: SQL Injection and Invalid Input
**Risk:** Malicious input may affect database queries or application behavior.
**Mitigation:** Use parameterized SQL queries and validate user input.

### Threat 9: Secret Exposure
**Risk:** Database credentials or JWT secrets may be exposed through source control.
**Mitigation:** Keep .env files and private uploads out of Git and use placeholder values in .env.example.

## 4. Security Testing Checklist
- Verify protected endpoints reject unauthenticated requests.
- Test invalid and expired authentication tokens.
- Verify users cannot access unauthorized documents.
- Test document-sharing permissions and permission revocation.
- Test invalid and oversized file uploads.
- Verify important actions generate audit records.
- Check that unauthorized users cannot access audit logs.
- Ensure secrets and private documents are not exposed.

## 5. Security Principles
- Least privilege
- Server-side authorization
- Default denial
- Defense in depth
- Accountability through audit logging
- Confidentiality of private documents

## 6. Known Limitations
This document describes potential threats and intended security controls. Each mitigation must be verified against the actual source code and tested before being considered implemented. Database-backed audit logs are not automatically tamper-proof.
