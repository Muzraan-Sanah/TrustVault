"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const pool = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

// ========================================
// PRIVATE FILE STORAGE
// ========================================

const uploadDirectory = path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, uploadDirectory);
    },

    filename: (req, file, callback) => {
        callback(null, crypto.randomUUID());
    }
});

// ========================================
// ALLOWED FILE TYPES
// ========================================

const allowedMimeTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain"
]);

const upload = multer({
    storage,

    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },

    fileFilter: (req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            return callback(
                new Error(
                    "Only PDF, JPEG, PNG and TXT files are allowed."
                )
            );
        }

        callback(null, true);
    }
});

// ========================================
// LIST THE LOGGED-IN OWNER'S DOCUMENTS
// ========================================

router.get("/", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                title,
                category,
                original_filename,
                mime_type,
                file_size,
                created_at,
                updated_at
             FROM documents
             WHERE owner_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        return res.json({
            message: "Documents retrieved successfully.",
            count: result.rows.length,
            documents: result.rows
        });
    } catch (error) {
        console.error("List documents error:", error.message);

        return res.status(500).json({
            error: "Unable to retrieve documents."
        });
    }
});

// ========================================
// UPLOAD A DOCUMENT
// ========================================

router.post(
    "/upload",
    authenticateToken,
    upload.single("document"),
    async (req, res) => {
        let client;
        let savedFilePath;

        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "Please select a document to upload."
                });
            }

            savedFilePath = path.join(
                uploadDirectory,
                req.file.filename
            );

            const { title, category } = req.body;

            if (
                typeof title !== "string" ||
                !title.trim() ||
                title.trim().length > 255
            ) {
                fs.unlinkSync(savedFilePath);

                return res.status(400).json({
                    error:
                        "Title is required and must not exceed 255 characters."
                });
            }

            if (
                typeof category !== "string" ||
                !category.trim() ||
                category.trim().length > 100
            ) {
                fs.unlinkSync(savedFilePath);

                return res.status(400).json({
                    error:
                        "Category is required and must not exceed 100 characters."
                });
            }

            client = await pool.connect();

            await client.query("BEGIN");

            const result = await client.query(
                `INSERT INTO documents (
                    owner_id,
                    title,
                    category,
                    storage_key,
                    original_filename,
                    mime_type,
                    file_size
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING
                    id,
                    owner_id,
                    title,
                    category,
                    original_filename,
                    mime_type,
                    file_size,
                    created_at`,
                [
                    req.user.id,
                    title.trim(),
                    category.trim(),
                    req.file.filename,
                    path.basename(req.file.originalname),
                    req.file.mimetype,
                    req.file.size
                ]
            );

            // Record the successful upload in the audit trail.
            await client.query(
                `INSERT INTO audit_logs
                    (actor_id, action, document_id, outcome, details)
                 VALUES ($1, 'document_uploaded', $2, 'success', $3)`,
                [
                    req.user.id,
                    result.rows[0].id,
                    JSON.stringify({
                        title: result.rows[0].title
                    })
                ]
            );

            await client.query("COMMIT");

            return res.status(201).json({
                message: "Document uploaded successfully.",
                document: result.rows[0]
            });
        } catch (error) {
            if (client) {
                await client.query("ROLLBACK").catch(() => {});
            }

            if (
                savedFilePath &&
                fs.existsSync(savedFilePath)
            ) {
                try {
                    fs.unlinkSync(savedFilePath);
                } catch (cleanupError) {
                    console.error(
                        "File cleanup error:",
                        cleanupError.message
                    );
                }
            }

            if (error instanceof multer.MulterError) {
                return res.status(400).json({
                    error:
                        "Upload failed. Check the file size and upload limits."
                });
            }

            if (
                error.message ===
                "Only PDF, JPEG, PNG and TXT files are allowed."
            ) {
                return res.status(400).json({
                    error: error.message
                });
            }

            console.error("Upload error:", error.message);

            return res.status(500).json({
                error: "Unable to upload document."
            });
        } finally {
            if (client) {
                client.release();
            }
        }
    }
);

// ========================================
// AUDIT TRAIL
// GET RECENT ACTIVITY FOR THE LOGGED-IN USER
// ========================================

router.get(
    "/audit-logs",
    authenticateToken,
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    al.id,
                    al.actor_id,
                    al.action,
                    al.document_id,
                    al.target_user_id,
                    al.outcome,
                    al.details,
                    al.created_at,
                    u.name AS actor_name,
                    u.email AS actor_email,
                    d.title AS document_title,
                    target.name AS target_user_name,
                    target.email AS target_user_email
                 FROM audit_logs al
                 LEFT JOIN users u
                    ON u.id = al.actor_id
                 LEFT JOIN documents d
                    ON d.id = al.document_id
                 LEFT JOIN users target
                    ON target.id = al.target_user_id
                 WHERE
                    al.actor_id = $1
                    OR EXISTS (
                        SELECT 1
                        FROM documents owned
                        WHERE owned.id = al.document_id
                          AND owned.owner_id = $1
                    )
                 ORDER BY al.created_at DESC
                 LIMIT 100`,
                [req.user.id]
            );

            // IMPORTANT:
            // app.js reads data.logs, so return the rows as "logs".
            return res.json({
                message: "Audit history retrieved successfully.",
                count: result.rows.length,
                logs: result.rows
            });
        } catch (error) {
            console.error("Audit logs error:", error.message);

            return res.status(500).json({
                error: "Unable to load activity history."
            });
        }
    }
);

// ========================================
// SHARE A DOCUMENT WITH ANOTHER USER
// ========================================

router.post("/:id/share", authenticateToken, async (req, res) => {
    const documentId = Number(req.params.id);
    const body = req.body || {};

    const email =
        typeof body.email === "string"
            ? body.email
            : typeof body.recipientEmail === "string"
                ? body.recipientEmail
                : "";

    const rawPermission =
        typeof body.permission === "string"
            ? body.permission
            : typeof body.access === "string"
                ? body.access
                : "";

    const normalizedPermission = rawPermission
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    let permission;

    if (
        normalizedPermission === "read" ||
        normalizedPermission === "read only" ||
        normalizedPermission === "view" ||
        normalizedPermission === "view only"
    ) {
        permission = "read";
    } else if (normalizedPermission === "edit") {
        permission = "edit";
    }

    if (!Number.isInteger(documentId) || documentId <= 0) {
        return res.status(400).json({
            error: "Invalid document ID."
        });
    }

    // Corrected email validation regex.
    if (
        !email.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !permission
    ) {
        return res.status(400).json({
            error:
                "A valid email and permission (read or edit) are required."
        });
    }

    let client;

    try {
        client = await pool.connect();

        await client.query("BEGIN");

        const documentResult = await client.query(
            `SELECT id
             FROM documents
             WHERE id = $1 AND owner_id = $2`,
            [documentId, req.user.id]
        );

        if (documentResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Document not found or you are not its owner."
            });
        }

        const userResult = await client.query(
            `SELECT id
             FROM users
             WHERE LOWER(email) = LOWER($1)`,
            [email.trim()]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Recipient user not found."
            });
        }

        const targetUserId = userResult.rows[0].id;

        if (String(targetUserId) === String(req.user.id)) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "You already own this document."
            });
        }

        await client.query(
            `INSERT INTO document_permissions
                (document_id, user_id, permission, granted_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (document_id, user_id)
             DO UPDATE SET
                permission = EXCLUDED.permission,
                granted_by = EXCLUDED.granted_by,
                granted_at = NOW(),
                revoked_at = NULL,
                revoked_by = NULL`,
            [
                documentId,
                targetUserId,
                permission,
                req.user.id
            ]
        );

        await client.query(
            `INSERT INTO audit_logs
                (actor_id, action, document_id, target_user_id,
                 outcome, details)
             VALUES ($1, 'document_shared', $2, $3, 'success', $4)`,
            [
                req.user.id,
                documentId,
                targetUserId,
                JSON.stringify({ permission })
            ]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            message: "Document shared successfully.",
            documentId,
            recipientUserId: targetUserId,
            permission
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Share document error:", error.message);

        return res.status(500).json({
            error: "Unable to share document."
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// ========================================
// VIEW DOCUMENTS SHARED WITH ME
// ========================================

router.get(
    "/shared-with-me",
    authenticateToken,
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    d.id,
                    d.title,
                    d.category,
                    d.original_filename,
                    d.mime_type,
                    d.file_size,
                    d.owner_id,
                    dp.permission,
                    dp.granted_at
                 FROM document_permissions dp
                 JOIN documents d
                    ON d.id = dp.document_id
                 WHERE dp.user_id = $1
                   AND dp.revoked_at IS NULL
                 ORDER BY dp.granted_at DESC`,
                [req.user.id]
            );

            return res.json({
                message: "Shared documents retrieved successfully.",
                count: result.rows.length,
                documents: result.rows
            });
        } catch (error) {
            console.error(
                "Shared documents error:",
                error.message
            );

            return res.status(500).json({
                error: "Unable to retrieve shared documents."
            });
        }
    }
);

// ========================================
// SECURE DOCUMENT DOWNLOAD
// ========================================

router.get(
    "/:id/download",
    authenticateToken,
    async (req, res) => {
        const documentId = Number(req.params.id);

        if (!Number.isInteger(documentId) || documentId <= 0) {
            return res.status(400).json({
                error: "Invalid document ID."
            });
        }

        try {
            const result = await pool.query(
                `SELECT d.*
                 FROM documents d
                 WHERE d.id = $1
                   AND (
                        d.owner_id = $2
                        OR EXISTS (
                            SELECT 1
                            FROM document_permissions dp
                            WHERE dp.document_id = d.id
                              AND dp.user_id = $2
                              AND dp.permission IN ('read', 'edit')
                              AND dp.revoked_at IS NULL
                        )
                   )`,
                [documentId, req.user.id]
            );

            if (result.rows.length === 0) {
                await pool.query(
                    `INSERT INTO audit_logs
                        (actor_id, action, document_id, outcome, details)
                     VALUES ($1, 'document_download', $2, 'denied', $3)`,
                    [
                        req.user.id,
                        documentId,
                        JSON.stringify({
                            reason: "not_found_or_not_authorized"
                        })
                    ]
                );

                return res.status(404).json({
                    error: "Document not found or access denied."
                });
            }

            const document = result.rows[0];

            const filePath = path.join(
                uploadDirectory,
                document.storage_key
            );

            if (!fs.existsSync(filePath)) {
                await pool.query(
                    `INSERT INTO audit_logs
                        (actor_id, action, document_id, outcome, details)
                     VALUES ($1, 'document_download', $2, 'failure', $3)`,
                    [
                        req.user.id,
                        documentId,
                        JSON.stringify({
                            reason: "stored_file_missing"
                        })
                    ]
                );

                return res.status(404).json({
                    error: "Stored document file was not found."
                });
            }

            await pool.query(
                `INSERT INTO audit_logs
                    (actor_id, action, document_id, outcome, details)
                 VALUES ($1, 'document_download', $2, 'success', $3)`,
                [
                    req.user.id,
                    documentId,
                    JSON.stringify({
                        title: document.title
                    })
                ]
            );

            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Content-Type", document.mime_type);

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${path.basename(
                    document.original_filename
                )}"`
            );

            return res.sendFile(filePath);
        } catch (error) {
            console.error(
                "Download document error:",
                error.message
            );

            if (!res.headersSent) {
                return res.status(500).json({
                    error: "Unable to download document."
                });
            }
        }
    }
);

// ========================================
// LIST DOCUMENTS SHARED BY THE OWNER
// ========================================

router.get(
    "/shared-by-me",
    authenticateToken,
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT
                    d.id AS document_id,
                    d.title AS document_title,
                    d.category,
                    u.id AS recipient_id,
                    u.name AS recipient_name,
                    u.email AS recipient_email,
                    dp.permission,
                    dp.granted_at,
                    dp.revoked_at,
                    CASE
                        WHEN dp.revoked_at IS NULL THEN 'active'
                        ELSE 'revoked'
                    END AS sharing_status
                 FROM documents d
                 JOIN document_permissions dp
                    ON dp.document_id = d.id
                 JOIN users u
                    ON u.id = dp.user_id
                 WHERE d.owner_id = $1
                 ORDER BY dp.granted_at DESC`,
                [req.user.id]
            );

            return res.json({
                message: "Sharing details retrieved successfully.",
                shares: result.rows
            });
        } catch (error) {
            console.error(
                "Shared-by-me error:",
                error.message
            );

            return res.status(500).json({
                error: "Unable to retrieve sharing details."
            });
        }
    }
);

// ========================================
// CHANGE A RECIPIENT'S PERMISSION
// ========================================

router.patch(
    "/:id/share/:userId",
    authenticateToken,
    async (req, res) => {
        const documentId = Number(req.params.id);
        const recipientId = Number(req.params.userId);
        const permission = req.body?.permission;

        if (
            !Number.isInteger(documentId) ||
            documentId <= 0 ||
            !Number.isInteger(recipientId) ||
            recipientId <= 0
        ) {
            return res.status(400).json({
                error: "Invalid document or recipient ID."
            });
        }

        if (!["read", "edit"].includes(permission)) {
            return res.status(400).json({
                error: "Permission must be read or edit."
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const result = await client.query(
                `UPDATE document_permissions dp
                 SET permission = $1
                 FROM documents d
                 WHERE dp.document_id = d.id
                   AND dp.document_id = $2
                   AND dp.user_id = $3
                   AND d.owner_id = $4
                   AND dp.revoked_at IS NULL
                 RETURNING dp.permission, dp.granted_at`,
                [
                    permission,
                    documentId,
                    recipientId,
                    req.user.id
                ]
            );

            if (result.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    error: "Active sharing permission not found."
                });
            }

            await client.query(
                `INSERT INTO audit_logs
                    (actor_id, action, document_id, target_user_id,
                     outcome, details)
                 VALUES ($1, 'permission_changed', $2, $3, 'success', $4)`,
                [
                    req.user.id,
                    documentId,
                    recipientId,
                    JSON.stringify({
                        newPermission: permission
                    })
                ]
            );

            await client.query("COMMIT");

            return res.json({
                message: "Permission updated successfully.",
                permission
            });
        } catch (error) {
            await client.query("ROLLBACK").catch(() => {});

            console.error(
                "Permission update error:",
                error.message
            );

            return res.status(500).json({
                error: "Unable to update permission."
            });
        } finally {
            client.release();
        }
    }
);

// ========================================
// REVOKE A RECIPIENT'S ACCESS
// ========================================

router.delete(
    "/:id/share/:userId",
    authenticateToken,
    async (req, res) => {
        const documentId = Number(req.params.id);
        const recipientId = Number(req.params.userId);

        if (
            !Number.isInteger(documentId) ||
            documentId <= 0 ||
            !Number.isInteger(recipientId) ||
            recipientId <= 0
        ) {
            return res.status(400).json({
                error: "Invalid document or recipient ID."
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const result = await client.query(
                `UPDATE document_permissions dp
                 SET revoked_at = NOW(),
                     revoked_by = $1
                 FROM documents d
                 WHERE dp.document_id = d.id
                   AND dp.document_id = $2
                   AND dp.user_id = $3
                   AND d.owner_id = $1
                   AND dp.revoked_at IS NULL
                 RETURNING dp.id`,
                [
                    req.user.id,
                    documentId,
                    recipientId
                ]
            );

            if (result.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    error: "Active sharing permission not found."
                });
            }

            await client.query(
                `INSERT INTO audit_logs
                    (actor_id, action, document_id, target_user_id,
                     outcome, details)
                 VALUES (
                    $1,
                    'document_access_revoked',
                    $2,
                    $3,
                    'success',
                    $4
                 )`,
                [
                    req.user.id,
                    documentId,
                    recipientId,
                    JSON.stringify({
                        reason: "owner_revoked_access"
                    })
                ]
            );

            await client.query("COMMIT");

            return res.json({
                message: "Access revoked successfully."
            });
        } catch (error) {
            await client.query("ROLLBACK").catch(() => {});

            console.error(
                "Revoke access error:",
                error.message
            );

            return res.status(500).json({
                error: "Unable to revoke access."
            });
        } finally {
            client.release();
        }
    }
);

// ========================================
// EXPORT ROUTER
// ========================================

module.exports = router;