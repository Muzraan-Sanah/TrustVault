# TrustVault — Secure Document Sharing

TrustVault is a secure document-sharing application designed to prevent unauthorized document access and maintain an audit trail of important activities.

## Features

* User registration and login
* JWT-based authentication
* Secure document uploads
* File size and file type restrictions
* Document ownership and access permissions
* Share documents with other registered users
* Read and edit permissions
* Revoke document access
* Download authorization checks
* Audit logging for important document activities
* Security headers using Helmet
* PostgreSQL database integration

## Technology Stack

* Backend: Node.js and Express
* Database: PostgreSQL
* Authentication: JSON Web Tokens (JWT)
* Password hashing: bcryptjs
* File uploads: Multer
* Security headers: Helmet
* Frontend: HTML, CSS and JavaScript

## Prerequisites

* Node.js and npm
* PostgreSQL
* Git

## Setup

1. Clone this repository.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with the database settings required by `db.js` and the JWT secret required by the authentication code.

4. Create the PostgreSQL database and tables required by the application.

5. Start the server:

   ```bash
   node server.js
   ```

6. Open `http://localhost:3000` in your browser.

## Security Notes

* Environment variables and uploaded documents should not be committed to Git.
* Document downloads require authentication and an ownership or active sharing permission check.
* Audit logs record selected document activities.
* File type restrictions based on MIME types do not guarantee that file contents are safe.
* Production deployment requires additional security testing and hardening.

## Project Documentation

See `THREATS.md` for the project's threat analysis and `PROMPTS.md` for development notes.

## Status

Developed as part of the TrustVault secure document-sharing hiring challenge.
