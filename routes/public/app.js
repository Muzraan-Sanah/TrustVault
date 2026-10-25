
"use strict";

// ========================================
// TRUSTVAULT FRONTEND APPLICATION
// ========================================

const API_BASE = "/api";

let authToken = localStorage.getItem("trustvault_token");
let currentAuthMode = "login";

// ========================================
// DOM HELPERS
// ========================================

function getElement(id) {
    return document.getElementById(id);
}

function showMessage(elementId, message, isError = false) {
    const element = getElement(elementId);
    if (!element) return;

    element.textContent = message;
    element.classList.add("message");
    element.classList.toggle("error", isError && Boolean(message));
    element.classList.toggle("success", !isError && Boolean(message));
}

function clearMessage(elementId) {
    showMessage(elementId, "");
}

// ========================================
// NAVIGATION HELPERS
// ========================================

function scrollToSection(sectionId) {
    const section = getElement(sectionId);
    if (!section) return;

    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function setActiveNavigation(activeLink) {
    document.querySelectorAll(".sidebar-nav a").forEach((link) => {
        const isActive = link === activeLink;

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

function setupSidebarNavigation() {
    const links = document.querySelectorAll(".sidebar-nav a");

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            const href = link.getAttribute("href");

            // Handle only links pointing to sections on this page.
            if (!href || !href.startsWith("#")) return;

            const sectionId = decodeURIComponent(href.slice(1));
            const section = getElement(sectionId);

            if (!section) return;

            event.preventDefault();

            setActiveNavigation(link);
            scrollToSection(sectionId);
        });
    });
}

function navigateToShareForm(documentId) {
    const idInput = getElement("share-document-id");

    if (idInput) {
        idInput.value = documentId;
    }

    const shareSection = getElement("share-document-section");

    if (shareSection) {
        scrollToSection("share-document-section");
    }

    if (idInput) {
        window.setTimeout(() => idInput.focus(), 350);
    }

    const shareLink = document.querySelector(
        '.sidebar-nav a[href="#share-document-section"]'
    );

    if (shareLink) {
        setActiveNavigation(shareLink);
    }
}

// ========================================
// API REQUEST HELPER
// ========================================

async function apiRequest(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});

    if (authToken) {
        headers.set("Authorization", `Bearer ${authToken}`);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (response.status === 401) {
        const message =
            typeof data === "object" && data !== null
                ? data.error || "Your session has expired. Please log in again."
                : "Your session has expired. Please log in again.";

        logout(false);
        throw new Error(message);
    }

    if (!response.ok) {
        const message =
            typeof data === "object" && data !== null
                ? data.error || "The request failed."
                : "The request failed.";

        throw new Error(message);
    }

    return data;
}

// ========================================
// SHOW LOGIN OR DASHBOARD
// ========================================

function showAuthForm() {
    const authSection = getElement("auth-section");
    const dashboard = getElement("dashboard");
    const profilePage = getElement("profile-page");
    const profileMenu = getElement("profile-menu");
    const profileDropdown = getElement("profile-dropdown");
    const profileMenuButton = getElement("profile-menu-button");

    if (authSection) authSection.hidden = false;
    if (dashboard) dashboard.hidden = true;
    if (profilePage) profilePage.hidden = true;

    if (profileMenu) profileMenu.hidden = true;
    if (profileDropdown) profileDropdown.hidden = true;

    if (profileMenuButton) {
        profileMenuButton.setAttribute("aria-expanded", "false");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showDashboard() {
    const authSection = getElement("auth-section");
    const dashboard = getElement("dashboard");
    const profilePage = getElement("profile-page");
    const profileMenu = getElement("profile-menu");
    const profileDropdown = getElement("profile-dropdown");
    const profileMenuButton = getElement("profile-menu-button");

    if (authSection) authSection.hidden = true;
    if (dashboard) dashboard.hidden = false;
    if (profilePage) profilePage.hidden = true;

    if (profileMenu) profileMenu.hidden = false;
    if (profileDropdown) profileDropdown.hidden = true;

    if (profileMenuButton) {
        profileMenuButton.setAttribute("aria-expanded", "false");
    }

    loadDocuments();
    loadSharedByMe();
    loadAuditHistory();
    loadMyProfile();
}

// ========================================
// PROFILE NAVIGATION
// ========================================

function toggleProfileDropdown() {
    const dropdown = getElement("profile-dropdown");
    const button = getElement("profile-menu-button");

    if (!dropdown || !button) return;

    const shouldOpen = dropdown.hidden;

    dropdown.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
}

function openProfilePage() {
    const authSection = getElement("auth-section");
    const dashboard = getElement("dashboard");
    const profilePage = getElement("profile-page");
    const dropdown = getElement("profile-dropdown");
    const menuButton = getElement("profile-menu-button");

    if (!authToken) {
        showAuthForm();
        return;
    }

    if (authSection) authSection.hidden = true;
    if (dashboard) dashboard.hidden = true;
    if (profilePage) profilePage.hidden = false;
    if (dropdown) dropdown.hidden = true;

    if (menuButton) {
        menuButton.setAttribute("aria-expanded", "false");
    }

    loadMyProfile();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToDashboard() {
    if (!authToken) {
        showAuthForm();
        return;
    }

    showDashboard();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ========================================
// LOGIN / REGISTRATION TAB SWITCHING
// ========================================

function setAuthMode(mode) {
    currentAuthMode = mode;

    const nameInput = getElement("name");
    const submitButton = getElement("auth-submit");
    const loginTab = getElement("login-tab");
    const registerTab = getElement("register-tab");
    const passwordInput = getElement("password");

    if (nameInput) {
        nameInput.hidden = mode !== "register";
        nameInput.required = mode === "register";
    }

    if (passwordInput) {
        passwordInput.autocomplete =
            mode === "register" ? "new-password" : "current-password";
    }

    if (submitButton) {
        submitButton.textContent =
            mode === "register" ? "Register" : "Login";
    }

    if (loginTab) {
        loginTab.setAttribute("aria-pressed", String(mode === "login"));
        loginTab.classList.toggle("active", mode === "login");
    }

    if (registerTab) {
        registerTab.setAttribute("aria-pressed", String(mode === "register"));
        registerTab.classList.toggle("active", mode === "register");
    }

    clearMessage("auth-message");
}

// ========================================
// HANDLE LOGIN AND REGISTRATION
// ========================================

async function handleAuthSubmit(event) {
    event.preventDefault();

    const nameInput = getElement("name");
    const emailInput = getElement("email");
    const passwordInput = getElement("password");
    const submitButton = getElement("auth-submit");

    if (!emailInput || !passwordInput) {
        showMessage("auth-message", "The login form could not be found.", true);
        return;
    }

    const body = {
        email: emailInput.value.trim(),
        password: passwordInput.value
    };

    if (currentAuthMode === "register") {
        const name = nameInput ? nameInput.value.trim() : "";

        if (!name) {
            showMessage("auth-message", "Please enter your name.", true);
            return;
        }

        body.name = name;
    }

    if (submitButton) submitButton.disabled = true;

    showMessage(
        "auth-message",
        currentAuthMode === "register"
            ? "Creating your account..."
            : "Logging in..."
    );

    try {
        const endpoint =
            currentAuthMode === "register"
                ? "/auth/register"
                : "/auth/login";

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Authentication failed.");
        }

        if (currentAuthMode === "register") {
            showMessage(
                "auth-message",
                "Registration successful! You can now log in."
            );

            if (nameInput) nameInput.value = "";
            if (passwordInput) passwordInput.value = "";

            setAuthMode("login");
            showMessage(
                "auth-message",
                "Registration successful! You can now log in."
            );

            return;
        }

        if (!data.token) {
            throw new Error(
                "Login succeeded but no authentication token was returned."
            );
        }

        authToken = data.token;
        localStorage.setItem("trustvault_token", authToken);

        passwordInput.value = "";
        showDashboard();
    } catch (error) {
        showMessage(
            "auth-message",
            error.message || "Unable to complete the request.",
            true
        );
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

// ========================================
// LOGOUT
// ========================================

function logout(showLogin = true) {
    authToken = null;
    localStorage.removeItem("trustvault_token");

    if (showLogin) {
        const passwordInput = getElement("password");
        if (passwordInput) passwordInput.value = "";

        showAuthForm();
        showMessage("auth-message", "You have been logged out.");
    } else {
        showAuthForm();
    }
}

// ========================================
// LOAD DOCUMENTS
// ========================================

async function loadDocuments() {
    await Promise.allSettled([
        loadMyDocuments(),
        loadSharedDocuments()
    ]);
}

// ========================================
// LOAD MY DOCUMENTS
// ========================================

async function loadMyDocuments() {
    const container = getElement("my-documents");
    if (!container) return;

    container.textContent = "Loading your documents...";

    try {
        const data = await apiRequest("/documents");

        const documents = Array.isArray(data)
            ? data
            : data.documents || data.data || [];

        container.replaceChildren();

        if (!documents.length) {
            container.textContent = "You have not uploaded any documents yet.";
            return;
        }

        documents.forEach((doc) => {
            const card = document.createElement("article");
            card.className = "document-card";

            const title = document.createElement("h3");
            title.textContent = doc.title || doc.filename || "Untitled document";

            const details = document.createElement("p");
            details.textContent =
                `Document ID: ${doc.id} | Category: ${doc.category || "Uncategorized"}`;

            const fileName = document.createElement("p");
            fileName.textContent =
                `File: ${doc.original_filename || doc.original_name || doc.filename || "Document"}`;

            const size = document.createElement("p");
            size.textContent =
                `Size: ${doc.file_size ?? doc.size ?? "Unknown"} bytes`;

            const downloadButton = document.createElement("button");
            downloadButton.type = "button";
            downloadButton.className = "secondary-button";
            downloadButton.textContent = "Download";
            downloadButton.addEventListener("click", () => downloadDocument(doc.id));

            const shareButton = document.createElement("button");
            shareButton.type = "button";
            shareButton.className = "secondary-button";
            shareButton.textContent = "Share";
            shareButton.addEventListener("click", () => {
                navigateToShareForm(doc.id);
            });

            card.append(
                title,
                details,
                fileName,
                size,
                downloadButton,
                shareButton
            );

            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

// ========================================
// LOAD DOCUMENTS SHARED WITH ME
// ========================================

async function loadSharedDocuments() {
    const container = getElement("shared-documents");
    if (!container) return;

    container.textContent = "Loading shared documents...";

    try {
        const data = await apiRequest("/documents/shared-with-me");

        const documents = Array.isArray(data)
            ? data
            : data.documents || data.data || [];

        container.replaceChildren();

        if (!documents.length) {
            container.textContent = "No documents have been shared with you yet.";
            return;
        }

        documents.forEach((doc) => {
            const card = document.createElement("article");
            card.className = "document-card";

            const title = document.createElement("h3");
            title.textContent = doc.title || doc.filename || "Shared document";

            const details = document.createElement("p");
            details.textContent =
                `Document ID: ${doc.id} | Category: ${doc.category || "Uncategorized"}`;

            const permission = document.createElement("p");
            permission.textContent = `Permission: ${doc.permission || "read only"}`;

            const downloadButton = document.createElement("button");
            downloadButton.type = "button";
            downloadButton.className = "secondary-button";
            downloadButton.textContent = "Download";
            downloadButton.addEventListener("click", () => downloadDocument(doc.id));

            card.append(title, details, permission, downloadButton);
            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = error.message;
    }
}

// ========================================
// UPLOAD A DOCUMENT
// ========================================

async function handleUpload(event) {
    event.preventDefault();

    const titleInput = getElement("document-title");
    const categoryInput = getElement("category");
    const fileInput = getElement("document-file");

    if (!titleInput || !categoryInput || !fileInput) {
        showMessage("upload-message", "The upload form is missing a required field.", true);
        return;
    }

    const title = titleInput.value.trim();
    const category = categoryInput.value.trim();
    const file = fileInput.files[0];

    if (!title || !category || !file) {
        showMessage("upload-message", "Please enter a title, category, and choose a file.", true);
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("document", file);

    const uploadButton = event.submitter;
    if (uploadButton) uploadButton.disabled = true;

    showMessage("upload-message", "Uploading your document...");

    try {
        await apiRequest("/documents/upload", {
            method: "POST",
            body: formData
        });

        showMessage("upload-message", "Document uploaded successfully!");

        titleInput.value = "";
        categoryInput.value = "";
        fileInput.value = "";

        await loadDocuments();
        await loadAuditHistory();
    } catch (error) {
        showMessage("upload-message", error.message || "Document upload failed.", true);
    } finally {
        if (uploadButton) uploadButton.disabled = false;
    }
}

// ========================================
// SHARE A DOCUMENT
// ========================================

async function handleShare(event) {
    event.preventDefault();

    const idInput = getElement("share-document-id");
    const emailInput = getElement("recipient-email");
    const permissionInput = getElement("permission");

    if (!idInput || !emailInput || !permissionInput) {
        showMessage("share-message", "The sharing form is missing a required field.", true);
        return;
    }

    const documentId = idInput.value.trim();
    const recipientEmail = emailInput.value.trim();
    const permission = permissionInput.value;

    if (!documentId || !recipientEmail || !permission) {
        showMessage("share-message", "Please complete all sharing fields.", true);
        return;
    }

    showMessage("share-message", "Sharing your document...");

    try {
        await apiRequest(
            `/documents/${encodeURIComponent(documentId)}/share`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipientEmail, permission })
            }
        );

        showMessage("share-message", "Document shared successfully!");
        emailInput.value = "";

        await loadDocuments();
        await loadSharedByMe();
        await loadAuditHistory();
    } catch (error) {
        showMessage("share-message", error.message || "Unable to share the document.", true);
    }
}

// ========================================
// DOWNLOAD A DOCUMENT
// ========================================

async function downloadDocument(documentId) {
    try {
        const response = await fetch(
            `${API_BASE}/documents/${encodeURIComponent(documentId)}/download`,
            {
                method: "GET",
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );

        if (response.status === 401) {
            logout(false);
            throw new Error("Your session has expired. Please log in again.");
        }

        if (!response.ok) {
            let message = "Unable to download the document.";

            try {
                const data = await response.json();
                message = data.error || message;
            } catch {
                // Keep the default error message.
            }

            throw new Error(message);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = `document-${documentId}`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

        await loadAuditHistory();
    } catch (error) {
        alert(error.message || "Document download failed.");
    }
}

// ========================================
// SHARED BY ME
// ========================================

async function loadSharedByMe() {
    const container = getElement("shared-by-me");
    if (!container) return;

    container.textContent = "Loading sharing details...";

    try {
        const data = await apiRequest("/documents/shared-by-me");
        const shares = Array.isArray(data) ? data : data.shares || [];

        container.replaceChildren();

        if (!shares.length) {
            container.textContent = "You haven't shared any documents yet.";
            return;
        }

        shares.forEach((share) => {
            const card = document.createElement("article");
            card.className = "document-card";

            const title = document.createElement("h3");
            title.textContent = share.document_title || "Shared document";

            const recipient = document.createElement("p");
            recipient.textContent =
                `Recipient: ${share.recipient_name || "User"} (${share.recipient_email || "Email unavailable"})`;

            const permissionText = document.createElement("p");
            permissionText.textContent = `Permission: ${share.permission}`;

            const status = document.createElement("p");
            status.textContent = `Status: ${share.sharing_status}`;

            card.append(title, recipient, permissionText, status);

            if (share.sharing_status === "active") {
                const select = document.createElement("select");
                select.setAttribute("aria-label", "Recipient permission");

                [
                    { value: "read", label: "Read only" },
                    { value: "edit", label: "Edit" }
                ].forEach((item) => {
                    const option = document.createElement("option");
                    option.value = item.value;
                    option.textContent = item.label;
                    select.appendChild(option);
                });

                select.value = share.permission;

                const updateButton = document.createElement("button");
                updateButton.type = "button";
                updateButton.className = "secondary-button";
                updateButton.textContent = "Update permission";

                updateButton.addEventListener("click", async () => {
                    updateButton.disabled = true;

                    try {
                        await apiRequest(
                            `/documents/${encodeURIComponent(share.document_id)}/share/${encodeURIComponent(share.recipient_id)}`,
                            {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ permission: select.value })
                            }
                        );

                        showMessage("shared-by-me-message", "Permission updated successfully.");

                        await loadSharedByMe();
                        await loadAuditHistory();
                    } catch (error) {
                        showMessage("shared-by-me-message", error.message, true);
                    } finally {
                        updateButton.disabled = false;
                    }
                });

                const revokeButton = document.createElement("button");
                revokeButton.type = "button";
                revokeButton.className = "secondary-button";
                revokeButton.textContent = "Revoke access";

                revokeButton.addEventListener("click", async () => {
                    if (!confirm(
                        `Revoke ${share.recipient_email}'s access to "${share.document_title}"?`
                    )) {
                        return;
                    }

                    revokeButton.disabled = true;

                    try {
                        await apiRequest(
                            `/documents/${encodeURIComponent(share.document_id)}/share/${encodeURIComponent(share.recipient_id)}`,
                            { method: "DELETE" }
                        );

                        showMessage("shared-by-me-message", "Access revoked successfully.");

                        await loadSharedByMe();
                        await loadDocuments();
                        await loadAuditHistory();
                    } catch (error) {
                        showMessage("shared-by-me-message", error.message, true);
                    } finally {
                        revokeButton.disabled = false;
                    }
                });

                card.append(select, updateButton, revokeButton);
            }

            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = `Unable to load sharing details: ${error.message}`;
    }
}

// ========================================
// AUDIT TRAIL
// Requires GET /api/documents/audit-logs
// ========================================

async function loadAuditHistory() {
    const container = getElement("audit-history");
    if (!container) return;

    container.textContent = "Loading activity history...";

    try {
        const data = await apiRequest("/documents/audit-logs");

        // Support both known API response formats.
        const logs = Array.isArray(data)
            ? data
            : data.auditLogs || data.logs || [];

        container.replaceChildren();

        if (!logs.length) {
            container.textContent = "No activity has been recorded yet.";
            return;
        }

        logs.forEach((log) => {
            const card = document.createElement("article");
            card.className = "document-card";

            const action = document.createElement("h3");
            action.textContent = String(log.action || "Activity");

            const outcome = document.createElement("p");
            outcome.textContent = `Outcome: ${log.outcome || "Not specified"}`;

            const documentId = document.createElement("p");
            documentId.textContent = `Document ID: ${log.document_id ?? "N/A"}`;

            const date = document.createElement("p");
            date.textContent = `Date: ${
                log.created_at
                    ? new Date(log.created_at).toLocaleString()
                    : "Unknown"
            }`;

            const details = document.createElement("p");
            let detailText = log.details || "";

            if (typeof detailText === "object") {
                detailText = JSON.stringify(detailText);
            }

            details.textContent = `Details: ${detailText || "None"}`;

            card.append(action, outcome, documentId, date, details);
            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = `Unable to load activity history: ${error.message}`;
    }
}

// ========================================
// MY PROFILE
// Requires GET /api/auth/me
// ========================================

async function loadMyProfile() {
    const container = getElement("profile-details");
    if (!container) return;

    container.textContent = "Loading profile...";

    try {
        const data = await apiRequest("/auth/me");
        const user = data.user || data;

        const navUserName = getElement("nav-user-name");
        const navUserAvatar = getElement("nav-user-avatar");
        const profilePageName = getElement("profile-page-name");
        const profilePageAvatar = getElement("profile-page-avatar");

        const displayName = user.name || user.email || "My Account";
        const initial = displayName.charAt(0).toUpperCase();

        if (navUserName) navUserName.textContent = displayName;
        if (navUserAvatar) navUserAvatar.textContent = initial;
        if (profilePageName) profilePageName.textContent = displayName;
        if (profilePageAvatar) profilePageAvatar.textContent = initial;

        // Fill existing edit fields if they are present.
        const editName = getElement("profile-edit-name");
        const editEmail = getElement("profile-edit-email");

        if (editName) editName.value = user.name || "";
        if (editEmail) editEmail.value = user.email || "";

        container.replaceChildren();

        const fields = [
            ["Name", user.name],
            ["Email", user.email],
            ["Role", user.role],
            [
                "Member since",
                user.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : null
            ]
        ];

        fields.forEach(([label, value]) => {
            if (value === undefined || value === null || value === "") return;

            const row = document.createElement("div");
            row.className = "profile-details-row";

            const labelElement = document.createElement("span");
            labelElement.textContent = label;

            const valueElement = document.createElement("strong");
            valueElement.textContent = String(value);

            row.append(labelElement, valueElement);
            container.appendChild(row);
        });

        if (!container.children.length) {
            container.textContent = "No profile details are available.";
        }
    } catch (error) {
        container.textContent = `Unable to load profile: ${error.message}`;
    }
}

// ========================================
// INITIALIZE APPLICATION
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    const authForm = getElement("auth-form");
    const loginTab = getElement("login-tab");
    const registerTab = getElement("register-tab");
    const logoutButton = getElement("logout-button");
    const profileLogoutButton = getElement("profile-logout-button");
    const profileMenuButton = getElement("profile-menu-button");
    const openProfileButton = getElement("open-profile-button");
    const backToDashboardButton = getElement("back-to-dashboard-button");

    const uploadForm = getElement("upload-form");
    const shareForm = getElement("share-form");
    const refreshButton = getElement("refresh-button");
    const refreshSharesButton = getElement("refresh-shares-button");
    const refreshAuditButton = getElement("refresh-audit-button");

    if (authForm) authForm.addEventListener("submit", handleAuthSubmit);

    if (loginTab) {
        loginTab.addEventListener("click", () => setAuthMode("login"));
    }

    if (registerTab) {
        registerTab.addEventListener("click", () => setAuthMode("register"));
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", () => logout(true));
    }

    if (profileLogoutButton) {
        profileLogoutButton.addEventListener("click", () => logout(true));
    }

    if (profileMenuButton) {
        profileMenuButton.addEventListener("click", toggleProfileDropdown);
    }

    if (openProfileButton) {
        openProfileButton.addEventListener("click", openProfilePage);
    }

    if (backToDashboardButton) {
        backToDashboardButton.addEventListener("click", returnToDashboard);
    }

    document.addEventListener("click", (event) => {
        const menu = getElement("profile-menu");
        const dropdown = getElement("profile-dropdown");
        const button = getElement("profile-menu-button");

        if (menu && dropdown && button && !menu.contains(event.target)) {
            dropdown.hidden = true;
            button.setAttribute("aria-expanded", "false");
        }
    });

    if (uploadForm) uploadForm.addEventListener("submit", handleUpload);
    if (shareForm) shareForm.addEventListener("submit", handleShare);

    if (refreshButton) {
        refreshButton.addEventListener("click", loadDocuments);
    }

    if (refreshSharesButton) {
        refreshSharesButton.addEventListener("click", loadSharedByMe);
    }

    if (refreshAuditButton) {
        refreshAuditButton.addEventListener("click", loadAuditHistory);
    }

    setupSidebarNavigation();
    setAuthMode("login");

    if (authToken) {
        showDashboard();
    } else {
        showAuthForm();
    }
});

