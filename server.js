require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const path = require("path");

const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const authenticateToken = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// SECURITY MIDDLEWARE
// ========================================

app.use(helmet());
app.use(express.json({ limit: "10kb" }));

// ========================================
// FRONTEND STATIC FILES
// ========================================

const publicDirectory = path.join(
    __dirname,
    "routes",
    "public"
);

app.use(express.static(publicDirectory));

// ========================================
// HOME ROUTE
// ========================================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(publicDirectory, "index.html")
    );
});

// ========================================
// HEALTH CHECK ROUTE
// ========================================

app.get("/api/health", (req, res) => {
    return res.status(200).json({
        status: "success",
        message: "TrustVault backend is running!"
    });
});

// ========================================
// AUTHENTICATION ROUTES
// ========================================

app.use("/api/auth", authRoutes);

// ========================================
// PROTECTED TEST ROUTE
// ========================================

app.get(
    "/api/protected",
    authenticateToken,
    (req, res) => {
        return res.status(200).json({
            status: "success",
            message:
                "You accessed a protected route successfully!",
            user: req.user
        });
    }
);

// ========================================
// DOCUMENT ROUTES
// ========================================

console.log("Registering document routes");

app.use(
    "/api/documents",
    (req, res, next) => {
        console.log(
            "Document request:",
            req.method,
            req.originalUrl
        );

        next();
    },
    documentRoutes
);

// ========================================
// HANDLE UNKNOWN ROUTES
// ========================================

app.use((req, res) => {
    console.warn(
        "404 - Route not found:",
        req.method,
        req.originalUrl
    );

    return res.status(404).json({
        status: "error",
        error: "Route not found.",
        path: req.originalUrl,
        method: req.method
    });
});

// ========================================
// GENERAL ERROR HANDLER
// ========================================

app.use((err, req, res, next) => {
    console.error("Server error:", err);

    if (res.headersSent) {
        return next(err);
    }

    const statusCode =
        Number.isInteger(err.statusCode) &&
        err.statusCode >= 400 &&
        err.statusCode <= 599
            ? err.statusCode
            : Number.isInteger(err.status) &&
              err.status >= 400 &&
              err.status <= 599
                ? err.status
                : 500;

    return res.status(statusCode).json({
        status: "error",
        error:
            statusCode >= 500
                ? "Internal server error."
                : err.message || "Request failed."
    });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
    console.log(
        `TrustVault server running at http://localhost:${PORT}`
    );

    console.log(
        `Health check: http://localhost:${PORT}/api/health`
    );

    console.log(
        "Frontend directory:",
        publicDirectory
    );

    console.log("Authentication routes: /api/auth");
    console.log("Document routes: /api/documents");
});