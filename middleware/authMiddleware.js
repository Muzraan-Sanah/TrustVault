const jwt = require("jsonwebtoken");

// Verify that the user is logged in
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    // Check whether the authorization header exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Authentication required. Please log in."
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            error: "Authentication token is missing."
        });
    }

    // Verify the token
    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"]
            }
        );

        // Attach the verified identity to the request
        req.user = {
            id: Number(decoded.sub),
            role: decoded.role
        };

        if (
            !Number.isSafeInteger(req.user.id) ||
            req.user.id <= 0 ||
            !["admin", "owner", "viewer"].includes(req.user.role)
        ) {
            return res.status(401).json({
                error: "Invalid authentication token."
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired authentication token."
        });
    }
}

module.exports = authenticateToken;