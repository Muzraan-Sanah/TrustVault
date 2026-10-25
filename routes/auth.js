
"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

// ========================================
// REGISTER A NEW USER
// ========================================

router.post("/register", async (req, res) => {
    const { name, email, password } = req.body || {};

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            error: "Name, email and password are required."
        });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length > 100) {
        return res.status(400).json({
            error: "Name must not exceed 100 characters."
        });
    }

    if (
        normalizedEmail.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
        return res.status(400).json({
            error: "Please provide a valid email address."
        });
    }

    if (password.length < 12) {
        return res.status(400).json({
            error: "Password must be at least 12 characters long."
        });
    }

    // Public registration cannot choose an elevated role.
    const role = "owner";

    try {
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, role, created_at`,
            [
                normalizedName,
                normalizedEmail,
                passwordHash,
                role
            ]
        );

        return res.status(201).json({
            message: "User registered successfully.",
            user: result.rows[0]
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: "An account with this email already exists."
            });
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            error: "Unable to register user."
        });
    }
});

// ========================================
// LOG IN AN EXISTING USER
// ========================================

router.post("/login", async (req, res) => {
    const { email, password } = req.body || {};

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            error: "Email and password are required."
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("Login configuration error: JWT_SECRET is missing.");

        return res.status(500).json({
            error: "Login service is not configured correctly."
        });
    }

    try {
        const result = await pool.query(
            `SELECT id, name, email, password_hash, role
             FROM users
             WHERE LOWER(email) = $1`,
            [email.trim().toLowerCase()]
        );

        const user = result.rows[0];

        if (!user || !user.password_hash) {
            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                sub: String(user.id),
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "15m",
                algorithm: "HS256"
            }
        );

        return res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            error: "Unable to log in."
        });
    }
});

// ========================================
// GET THE LOGGED-IN USER'S PROFILE
// GET /api/auth/me
// ========================================

router.get("/me", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role, created_at
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found."
            });
        }

        return res.json({
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Profile retrieval error:", error.message);

        return res.status(500).json({
            error: "Unable to load profile."
        });
    }
});

// ========================================
// EDIT PROFILE
// PATCH /api/auth/me
// ========================================

router.patch("/me", authenticateToken, async (req, res) => {
    const { name, email } = req.body || {};

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        !name.trim() ||
        !email.trim()
    ) {
        return res.status(400).json({
            error: "Name and email are required."
        });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length > 100) {
        return res.status(400).json({
            error: "Name must not exceed 100 characters."
        });
    }

    if (
        normalizedEmail.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
        return res.status(400).json({
            error: "Please provide a valid email address."
        });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET name = $1, email = $2
             WHERE id = $3
             RETURNING id, name, email, role, created_at`,
            [
                normalizedName,
                normalizedEmail,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found."
            });
        }

        return res.json({
            message: "Profile updated successfully.",
            user: result.rows[0]
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: "An account with this email already exists."
            });
        }

        console.error("Profile update error:", error.message);

        return res.status(500).json({
            error: "Unable to update profile."
        });
    }
});

// ========================================
// CHANGE PASSWORD
// PATCH /api/auth/change-password
// ========================================

router.patch(
    "/change-password",
    authenticateToken,
    async (req, res) => {
        const { currentPassword, newPassword } = req.body || {};

        if (
            typeof currentPassword !== "string" ||
            typeof newPassword !== "string" ||
            !currentPassword ||
            !newPassword
        ) {
            return res.status(400).json({
                error: "Current password and new password are required."
            });
        }

        if (newPassword.length < 12) {
            return res.status(400).json({
                error: "The new password must be at least 12 characters long."
            });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({
                error: "The new password must differ from the current password."
            });
        }

        try {
            const result = await pool.query(
                `SELECT password_hash
                 FROM users
                 WHERE id = $1`,
                [req.user.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "User not found."
                });
            }

            const passwordMatches = await bcrypt.compare(
                currentPassword,
                result.rows[0].password_hash
            );

            if (!passwordMatches) {
                return res.status(400).json({
                    error: "Your current password is incorrect."
                });
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 12);

            await pool.query(
                `UPDATE users
                 SET password_hash = $1
                 WHERE id = $2`,
                [newPasswordHash, req.user.id]
            );

            return res.json({
                message: "Password changed successfully. Please log in again."
            });
        } catch (error) {
            console.error("Password change error:", error.message);

            return res.status(500).json({
                error: "Unable to change password."
            });
        }
    }
);

// ========================================
// DELETE ACCOUNT
// DELETE /api/auth/me
//
// Preserve documents and audit history.
// If they reference this account, require a
// separate retention/transfer workflow.
// ========================================

router.delete("/me", authenticateToken, async (req, res) => {
    const { password } = req.body || {};

    if (typeof password !== "string" || !password) {
        return res.status(400).json({
            error: "Your password is required to delete your account."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const userResult = await client.query(
            `SELECT id, password_hash
             FROM users
             WHERE id = $1
             FOR UPDATE`,
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "User not found."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            userResult.rows[0].password_hash
        );

        if (!passwordMatches) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Your password is incorrect."
            });
        }

        const ownedDocuments = await client.query(
            `SELECT id
             FROM documents
             WHERE owner_id = $1
             LIMIT 1`,
            [req.user.id]
        );

        if (ownedDocuments.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: "Your account owns documents. Transfer or remove those documents using an approved retention workflow before deleting the account."
            });
        }

        const auditRecords = await client.query(
            `SELECT id
             FROM audit_logs
             WHERE actor_id = $1 OR target_user_id = $1
             LIMIT 1`,
            [req.user.id]
        );

        if (auditRecords.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: "Your account is referenced by audit history. Preserve that history and complete the account-retention workflow before deleting the account."
            });
        }

        // Remove this user's sharing permissions.
        // Preserve audit records and documents.

        await client.query(
            `DELETE FROM document_permissions
             WHERE user_id = $1 OR granted_by = $1 OR revoked_by = $1`,
            [req.user.id]
        );

        await client.query(
            `DELETE FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        await client.query("COMMIT");

        return res.json({
            message: "Account deleted successfully. You have been logged out."
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Account deletion error:", error.message);

        return res.status(500).json({
            error: "Unable to delete the account safely."
        });
    } finally {
        client.release();
    }
});

module.exports = router;

