"use client";

import { useState, useEffect, useRef } from "react";

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface CapabilityVersion {
  id: string;
  version: string;
  status: string;
  harnesses: string[];
  createdAt: string;
  comments: Comment[];
  zipPath?: string;
  extractedPath?: string;
}

interface Capability {
  id: string;
  name: string;
  description: string;
  type: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  tags?: any[];
  latestVersion: CapabilityVersion;
  versions: CapabilityVersion[];
}

interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface FileDiff {
  fileName: string;
  hasChanges: boolean;
  oldContent: string | null;
  newContent: string | null;
  diffParts: DiffPart[];
}

interface DiffResponse {
  isFirstVersion: boolean;
  previousVersion: string | null;
  diffs: FileDiff[];
}

export default function Home() {
  // --- Global States ---
  const [viewMode, setViewMode] = useState<"public" | "developer" | "admin">("public");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- New Menu, Tag & User States ---
  const [activeTab, setActiveTab] = useState<"catalog" | "tags" | "users">("catalog");
  const [currentUser, setCurrentUser] = useState<string>("");
  const [sessionRoles, setSessionRoles] = useState<string[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([
    { username: "admin", roles: "USER,ADMIN" },
    { username: "user", roles: "USER" }
  ]);

  // --- Login Authentication States ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState<boolean>(false);

  // --- Registration & Modal States ---
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginModalTab, setLoginModalTab] = useState<"login" | "register">("login");
  const [registerUsername, setRegisterUsername] = useState<string>("");
  const [registerPassword, setRegisterPassword] = useState<string>("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState<string>("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registering, setRegistering] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState<boolean>(false);
  const [origin, setOrigin] = useState("http://localhost:3000");
  
  // Tag Management
  const [allTags, setAllTags] = useState<any[]>([]);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#0d9488");
  const [newTagDesc, setNewTagDesc] = useState("");
  
  // User Management
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>(["USER"]);
  const [isUpdatePasswordOpen, setIsUpdatePasswordOpen] = useState(false);
  const [selectedUserForPasswordUpdate, setSelectedUserForPasswordUpdate] = useState<any | null>(null);
  const [newUserPasswordUpdate, setNewUserPasswordUpdate] = useState("");
  const [confirmUserPassword, setConfirmUserPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Self User Password Update Management
  const [isSelfPasswordOpen, setIsSelfPasswordOpen] = useState(false);
  const [selfOldPassword, setSelfOldPassword] = useState("");
  const [selfNewPassword, setSelfNewPassword] = useState("");
  const [selfConfirmPassword, setSelfConfirmPassword] = useState("");
  const [selfUpdating, setSelfUpdating] = useState(false);

  // Tag selection for administrative reviews
  const [selectedTagIdsForApproval, setSelectedTagIdsForApproval] = useState<string[]>([]);

  // Synchronize theme with body dataset attribute
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  // --- Filter States ---
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedHarness, setSelectedHarness] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // --- Detail View States ---
  const [selectedCapability, setSelectedCapability] = useState<Capability | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<CapabilityVersion | null>(null);
  const [activeInstallTab, setActiveInstallTab] = useState<string>("");

  // --- Ingestion / Import States ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<"file" | "git">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState("");
  const [gitTag, setGitTag] = useState("");
  const [importComment, setImportComment] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ingestion / Import Step-by-Step Wizard States
  const [importStep, setImportStep] = useState<"upload" | "confirm">("upload");
  const [parsedMetadata, setParsedMetadata] = useState<any | null>(null);

  // Ingestion Manual Forms
  const [enteredName, setEnteredName] = useState("");
  const [enteredVersion, setEnteredVersion] = useState("");
  const [enteredOwner, setEnteredOwner] = useState("");
  const [enteredDescription, setEnteredDescription] = useState("");
  const [enteredHarnesses, setEnteredHarnesses] = useState<string[]>([]);
  const [enteredType, setEnteredType] = useState("SKILL");

  // --- Comment Input State ---
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // --- Administrative Diff States ---
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [selectedDiffFile, setSelectedDiffFile] = useState<FileDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // --- File Explorer States ---
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [loadingFileTree, setLoadingFileTree] = useState(false);
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  // --- Fetch Capabilities ---
  const fetchCapabilities = async (mode = viewMode) => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        viewMode: mode,
        search,
        type: selectedType,
        harness: selectedHarness,
      });

      const res = await fetch(`/api/capabilities?${queryParams.toString()}`, {
        headers: {
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        }
      });
      if (!res.ok) {
        throw new Error("Failed to load capability registry catalog.");
      }
      let data = await res.json();
      
      // Client-side capability status filter
      if (selectedStatus !== "") {
        const statusUpper = selectedStatus.toUpperCase();
        data = data.filter((c: any) => c.latestVersion.status === statusUpper);
      }

      setCapabilities(data);

      // Keep selection in sync if capability is selected
      if (selectedCapability) {
        const updated = data.find((c: Capability) => c.id === selectedCapability.id);
        if (updated) {
          setSelectedCapability(updated);
          // Sync selected version as well
          const updatedVer = updated.versions.find((v: CapabilityVersion) => v.id === selectedVersion?.id);
          if (updatedVer) {
            setSelectedVersion(updatedVer);
          } else {
            setSelectedVersion(updated.latestVersion);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when parameters or role changes
  useEffect(() => {
    fetchCapabilities();
  }, [viewMode, search, selectedType, selectedHarness, selectedStatus, currentUser, sessionRoles, isAuthenticated]);

  // Fetch Diff files for Pending Reviews
  const fetchDiffData = async (versionId: string) => {
    try {
      setLoadingDiff(true);
      setDiffData(null);
      setSelectedDiffFile(null);
      const res = await fetch(`/api/capabilities/versions/${versionId}/diff`, {
        headers: {
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        }
      });
      if (!res.ok) {
        throw new Error("Failed to load file change diff logs.");
      }
      const data: DiffResponse = await res.json();
      setDiffData(data);
      if (data.diffs && data.diffs.length > 0) {
        setSelectedDiffFile(data.diffs[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDiff(false);
    }
  };

  // Sync Diff Panel when version selection changes (in Admin view)
  useEffect(() => {
    if (viewMode === "admin" && selectedVersion && selectedVersion.status === "PENDING_REVIEW") {
      fetchDiffData(selectedVersion.id);
    } else {
      setDiffData(null);
      setSelectedDiffFile(null);
    }
  }, [selectedVersion, viewMode]);

  // Sync active install tabs
  useEffect(() => {
    if (selectedVersion) {
      const harnesses = selectedVersion.harnesses;
      const supportedIds = ["claude", "opencode", "codex", "github-copilot", "ghcp"];
      const filtered = harnesses.filter(h => supportedIds.includes(h));
      if (filtered && filtered.length > 0) {
        setActiveInstallTab(filtered[0]);
      } else {
        setActiveInstallTab("");
      }
    }
  }, [selectedVersion]);

  // Fetch capability version file tree explorer
  useEffect(() => {
    if (selectedVersion) {
      const fetchTree = async () => {
        try {
          setLoadingFileTree(true);
          setSelectedFilePath(null);
          setSelectedFileContent(null);
          const res = await fetch(`/api/capabilities/versions/${selectedVersion.id}/files`, {
            headers: {
              "x-simulated-user": currentUser,
              "x-simulated-roles": sessionRoles.join(","),
            }
          });
          if (!res.ok) throw new Error("Failed to load files.");
          const data = await res.json();
          setFileTree(data);
          // Auto-expand root folders
          const initialExpanded: Record<string, boolean> = {};
          data.forEach((node: any) => {
            if (node.isFolder) initialExpanded[node.path] = true;
          });
          setExpandedFolders(initialExpanded);
        } catch (e) {
          console.error(e);
          setFileTree([]);
        } finally {
          setLoadingFileTree(false);
        }
      };
      fetchTree();
    } else {
      setFileTree([]);
      setSelectedFilePath(null);
      setSelectedFileContent(null);
    }
  }, [selectedVersion]);

  const handleFileClick = async (filePath: string) => {
    if (!selectedVersion) return;
    try {
      setLoadingFileContent(true);
      setSelectedFilePath(filePath);
      setSelectedFileContent(null);
      const res = await fetch(
        `/api/capabilities/versions/${selectedVersion.id}/files?file=${encodeURIComponent(filePath)}`, {
          headers: {
            "x-simulated-user": currentUser,
            "x-simulated-roles": sessionRoles.join(","),
          }
        }
      );
      if (!res.ok) throw new Error("Failed to read file.");
      const data = await res.json();
      setSelectedFileContent(data.content);
    } catch (e: any) {
      console.error(e);
      setSelectedFileContent(`Error loading file content: ${e.message}`);
    } finally {
      setLoadingFileContent(false);
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const renderFileTree = (nodes: any[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isExpanded = !!expandedFolders[node.path];
      
      if (node.isFolder) {
        return (
          <div key={node.path} className="tree-node">
            <div
              className="tree-row"
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <span className="tree-icon">{isExpanded ? "📂" : "📁"}</span>
              <span style={{ fontWeight: 500 }}>{node.name}</span>
            </div>
            {isExpanded && node.children && node.children.length > 0 && (
              <div className="tree-children">
                {renderFileTree(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      } else {
        const isActive = selectedFilePath === node.path;
        return (
          <div
            key={node.path}
            className={`tree-row ${isActive ? "active" : ""}`}
            onClick={() => handleFileClick(node.path)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <span className="tree-icon">📄</span>
            <span>{node.name}</span>
          </div>
        );
      }
    });
  };

  // --- Handlers ---
  
  const handleCardClick = (cap: Capability) => {
    setSelectedCapability(cap);
    setSelectedVersion(cap.latestVersion);
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedCapability) return;
    const versionId = e.target.value;
    const ver = selectedCapability.versions.find((v) => v.id === versionId);
    if (ver) {
      setSelectedVersion(ver);
    }
  };

  const handleDownloadZip = async () => {
    if (!selectedVersion || !selectedCapability) return;
    try {
      const res = await fetch(`/api/capabilities/versions/${selectedVersion.id}/download`, {
        headers: {
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to download ZIP bundle.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedCapability.name}-${selectedVersion.version}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error downloading file");
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as "public" | "developer" | "admin";
    setViewMode(newRole);
    // Clear selection on view mode change to reset UI context
    setSelectedCapability(null);
    setSelectedVersion(null);
    setDiffData(null);
    setSelectedDiffFile(null);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      if (importType === "file") {
        if (!selectedFile) {
          throw new Error("Please select a standard capability ZIP bundle.");
        }
        formData.append("file", selectedFile);
      } else {
        if (!gitUrl || !gitTag) {
          throw new Error("Both Enterprise Git Repository URL and Release Tag are required.");
        }
        formData.append("gitUrl", gitUrl);
        formData.append("gitTag", gitTag);
      }

      // Step 1: Submit to backend parse endpoint to verify .capability.json
      const res = await fetch("/api/capabilities/parse", {
        method: "POST",
        headers: {
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse capability package.");
      }

      // Transition to Step 2 (Confirm / Input screen)
      setParsedMetadata(data);
      setImportStep("confirm");

      // Initialize entered fields using parsed metadata
      if (data.metadata) {
        setEnteredName(data.metadata.name || "");
        setEnteredVersion(data.metadata.version || "");
        setEnteredOwner(data.metadata.owner || "");
        setEnteredDescription(data.metadata.description || "");
        setEnteredHarnesses(data.metadata.harnesses || []);
        setEnteredType(data.metadata.type || "SKILL");
      }
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "An unexpected parsing error occurred.");
    } finally {
      setImporting(false);
    }
  };

  const handleImportConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setImportError(null);

    try {
      // Input validation for capability metadata
      if (!enteredName.trim() || !enteredVersion.trim() || !enteredOwner.trim() || !enteredDescription.trim()) {
        throw new Error("All capability metadata fields are required.");
      }
      const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
      if (!semverRegex.test(enteredVersion.trim())) {
        throw new Error("Invalid version format. Must adhere to strict semver (e.g., '1.0.0').");
      }
      if (enteredHarnesses.length === 0) {
        throw new Error("Please select at least one supported client harness.");
      }

      const formData = new FormData();
      if (importType === "file") {
        if (!selectedFile) throw new Error("File not found.");
        formData.append("file", selectedFile);
      } else {
        if (!gitUrl || !gitTag) throw new Error("Git Repository URL and Tag are required.");
        formData.append("gitUrl", gitUrl);
        formData.append("gitTag", gitTag);
      }

      formData.append("comment", importComment || "Initial upload.");

      // Always pass the confirmed/entered metadata fields to capabilities POST endpoint
      formData.append("name", enteredName.trim());
      formData.append("version", enteredVersion.trim());
      formData.append("owner", enteredOwner.trim());
      formData.append("description", enteredDescription.trim());
      formData.append("harnesses", JSON.stringify(enteredHarnesses));
      formData.append("type", enteredType);

      const res = await fetch("/api/capabilities", {
        method: "POST",
        headers: {
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to finalize capability import.");
      }

      // Success Reset
      setIsImportModalOpen(false);
      setImportStep("upload");
      setParsedMetadata(null);
      setSelectedFile(null);
      setGitUrl("");
      setGitTag("");
      setImportComment("");
      setEnteredName("");
      setEnteredVersion("");
      setEnteredOwner("");
      setEnteredDescription("");
      setEnteredHarnesses([]);
      setEnteredType("SKILL");

      alert(`Capability '${data.name}' imported successfully as Draft!`);
      fetchCapabilities();
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "An unexpected import confirmation error occurred.");
    } finally {
      setImporting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersion || !newCommentText.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/capabilities/versions/${selectedVersion.id}/comments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
        body: JSON.stringify({
          author: viewMode === "admin" ? "Admin" : "Developer",
          text: newCommentText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add audit log comment.");
      }

      setNewCommentText("");
      // Refresh capabilities to fetch new comment
      await fetchCapabilities();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error submitting comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusTransition = async (action: string, versionId: string) => {
    if (!confirm(`Are you sure you want to trigger this action (${action})?`)) return;

    try {
      const res = await fetch(`/api/capabilities/versions/${versionId}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
        body: JSON.stringify({ 
          action,
          tagIds: action === "APPROVE" ? selectedTagIdsForApproval : undefined
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to perform lifecycle transition.");
      }

      if (action === "ROLLBACK") {
        alert(`Success: Deprecated this active version and successfully rolled back production environment to version ${data.rolledBackTo}!`);
      } else {
        alert(`Status updated successfully!`);
      }

      // Refresh capabilities
      await fetchCapabilities();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update lifecycle status.");
    }
  };

  const handleDeleteCapability = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete the capability '${name}'?\nThis will permanently delete all its versions, comments, and physical storage files.`)) return;

    try {
      const res = await fetch(`/api/capabilities/${id}`, {
        method: "DELETE",
        headers: { 
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete capability.");
      }

      alert(`Capability '${name}' deleted successfully!`);
      setSelectedCapability(null);
      setSelectedVersion(null);
      // Refresh capabilities list
      await fetchCapabilities();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to delete capability.");
    }
  };

  const handleDeleteVersion = async (versionId: string, versionStr: string, capabilityName: string) => {
    if (!confirm(`Are you sure you want to permanently delete version v${versionStr} of '${capabilityName}'?\nThis will permanently delete this version's files and comments.`)) return;

    try {
      const res = await fetch(`/api/capabilities/versions/${versionId}`, {
        method: "DELETE",
        headers: { 
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete capability version.");
      }

      alert(data.message || `Version v${versionStr} deleted successfully!`);
      setSelectedCapability(null);
      setSelectedVersion(null);
      // Refresh capabilities list
      await fetchCapabilities();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to delete capability version.");
    }
  };

  // Helper to get type badge
  const renderTypeBadge = (type: string) => {
    const lower = type.toLowerCase();
    return (
      <span className={`badge badge-${lower}`}>
        {type}
      </span>
    );
  };

  // Helper to get status badge
  const renderStatusBadge = (status: string) => {
    const lower = status.toLowerCase().replace("_", "-");
    return (
      <span className={`status-badge status-${lower}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  // --- Login & Authentication Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Please enter both username and password.");
      return;
    }

    setAuthenticating(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      // Success
      setCurrentUser(data.username);
      setSessionRoles(data.roles.split(","));
      setIsAuthenticated(true);
      setLoginUsername("");
      setLoginPassword("");
      setIsLoginModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || "Invalid username or password.");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerUsername.trim() || !registerPassword.trim() || !registerConfirmPassword.trim()) {
      setRegisterError("All registration fields are required.");
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    if (registerPassword.length < 6) {
      setRegisterError("Password must be at least 6 characters long.");
      return;
    }

    setRegistering(true);
    setRegisterError(null);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerUsername.trim(),
          password: registerPassword,
          confirmPassword: registerConfirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      // Success! Automatically log them in!
      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerUsername.trim(),
          password: registerPassword,
        }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error(loginData.error || "Registration succeeded but automatic login failed.");
      }

      setCurrentUser(loginData.username);
      setSessionRoles(loginData.roles.split(","));
      setIsAuthenticated(true);
      setIsLoginModalOpen(false);

      // Reset form fields
      setRegisterUsername("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      alert("Registration completed successfully! Welcome, " + loginData.username);
    } catch (err: any) {
      console.error(err);
      setRegisterError(err.message || "An unexpected registration error occurred.");
    } finally {
      setRegistering(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser("");
    setSessionRoles([]);
    setCapabilities([]);
    setSelectedCapability(null);
    setSelectedVersion(null);
    setActiveTab("catalog");
    setViewMode("public");
  };

  // Generate dynamic installation commands based on tab selection
  // --- Tag & User Fetching and CRUD Effects ---
  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setAllTags(data);
      }
    } catch (e) {
      console.error("Failed to fetch tags:", e);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch("/api/users", {
        headers: {
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (e) {
      console.error("Failed to fetch users:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    fetchTags();
    // Fetch users on mount exactly once to populate the session dropdown
    const initUsers = async () => {
      try {
        const res = await fetch("/api/users", {
          headers: {
            "x-simulated-user": "admin",
            "x-simulated-roles": "USER,ADMIN",
          }
        });
        if (res.ok) {
          const data = await res.json();
          setSystemUsers(prev => {
            const merged = [...prev];
            data.forEach((dbu: any) => {
              if (!merged.some(m => m.username === dbu.username)) {
                merged.push({ username: dbu.username, roles: dbu.roles });
              }
            });
            return merged;
          });
        }
      } catch (e) {
        console.error("Failed to load initial session users:", e);
      }
    };
    initUsers();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      if (activeTab !== "catalog") {
        setActiveTab("catalog");
      }
      if (viewMode !== "public") {
        setViewMode("public");
      }
      return;
    }

    const selected = systemUsers.find(u => u.username === currentUser);
    if (selected) {
      const roles = selected.roles.split(",");
      setSessionRoles(roles);
    }
  }, [currentUser, systemUsers, isAuthenticated, activeTab, viewMode]);

  useEffect(() => {
    if (isAuthenticated && !sessionRoles.includes("ADMIN")) {
      if (activeTab === "tags" || activeTab === "users") {
        setActiveTab("catalog");
      }
      if (viewMode === "admin") {
        setViewMode("developer");
      }
    }
  }, [isAuthenticated, sessionRoles, activeTab, viewMode]);

  useEffect(() => {
    if (activeTab === "users" && sessionRoles.includes("ADMIN")) {
      fetchUsers();
    }
  }, [activeTab, sessionRoles]);

  // Synchronize tag checkboxes for capability approval
  useEffect(() => {
    if (selectedCapability) {
      setSelectedTagIdsForApproval((selectedCapability.tags || []).map((t: any) => t.id));
    } else {
      setSelectedTagIdsForApproval([]);
    }
  }, [selectedCapability]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
          description: newTagDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create tag.");

      alert("Tag created successfully!");
      setIsCreateTagOpen(false);
      setNewTagName("");
      setNewTagDesc("");
      await fetchTags();
    } catch (err: any) {
      alert(err.message || "Error creating tag");
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tag?")) return;

    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: "DELETE",
        headers: {
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete tag.");

      alert("Tag deleted successfully!");
      await fetchTags();
      await fetchCapabilities();
    } catch (err: any) {
      alert(err.message || "Error deleting tag");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserPassword.trim()) {
      alert("Username and Password are required.");
      return;
    }

    try {
      const rolesString = newUserRoles.join(",");
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newUserPassword,
          roles: rolesString,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user.");

      alert("User provisioned successfully!");
      setIsCreateUserOpen(false);
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRoles(["USER"]);
      setSystemUsers(prev => [...prev, { username: newUsername.trim(), roles: rolesString }]);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || "Error creating user");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPasswordUpdate || !newUserPasswordUpdate.trim() || !confirmUserPassword.trim()) {
      alert("Both password fields are required.");
      return;
    }

    if (newUserPasswordUpdate !== confirmUserPassword) {
      alert("New passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
        body: JSON.stringify({
          userId: selectedUserForPasswordUpdate.id,
          password: newUserPasswordUpdate.trim(),
          confirmPassword: confirmUserPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password.");

      alert(`Password for user "${selectedUserForPasswordUpdate.username}" updated successfully!`);
      setIsUpdatePasswordOpen(false);
      setSelectedUserForPasswordUpdate(null);
      setNewUserPasswordUpdate("");
      setConfirmUserPassword("");
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || "Error updating password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSelfUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfOldPassword.trim() || !selfNewPassword.trim() || !selfConfirmPassword.trim()) {
      alert("All password fields are required.");
      return;
    }

    if (selfNewPassword !== selfConfirmPassword) {
      alert("New passwords do not match.");
      return;
    }

    setSelfUpdating(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-simulated-user": currentUser,
          "x-simulated-roles": sessionRoles.join(","),
        },
        body: JSON.stringify({
          oldPassword: selfOldPassword.trim(),
          password: selfNewPassword.trim(),
          confirmPassword: selfConfirmPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password.");

      alert("Your password has been updated successfully!");
      setIsSelfPasswordOpen(false);
      setSelfOldPassword("");
      setSelfNewPassword("");
      setSelfConfirmPassword("");
    } catch (err: any) {
      alert(err.message || "Error updating password");
    } finally {
      setSelfUpdating(false);
    }
  };

  // Generate dynamic installation commands based on tab selection
  const getInstallCommand = (capName: string, verStr: string, tab: string) => {
    return `curl -fsSL ${origin}/api/install/${capName}/${verStr} | bash`;
  };



  return (
    <div className="app-container">
      {/* --- Left Column: Sleek Navigation Sidebar --- */}
      <aside className={`app-sidebar ${isSidebarCollapsed ? "collapsed" : ""}`} style={{ width: isSidebarCollapsed ? "70px" : "250px", transition: "width 0.2s ease" }}>
        <div className="sidebar-logo" style={{ padding: isSidebarCollapsed ? "0 10px 20px 10px" : "0 20px 20px 20px", display: "flex", flexDirection: isSidebarCollapsed ? "column" : "row", alignItems: "center", gap: "10px", justifyContent: isSidebarCollapsed ? "center" : "space-between" }}>
          <div className="brand-logo" style={{ width: "auto", padding: "4px 8px", fontSize: "14px", fontWeight: "800", background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>EMA</div>
          <button 
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? "▶" : "◀"}
          </button>
        </div>

        <div className="sidebar-nav" style={{ padding: isSidebarCollapsed ? "0 5px" : "0 10px" }}>
          {!isSidebarCollapsed && <div className="sidebar-nav-header">Registry Catalog</div>}
          <div
            className={`sidebar-nav-item ${activeTab === "catalog" && viewMode === "public" ? "active" : ""}`}
            onClick={() => { setActiveTab("catalog"); setViewMode("public"); }}
            style={{ justifyContent: isSidebarCollapsed ? "center" : "flex-start", padding: isSidebarCollapsed ? "10px 0" : "10px 12px" }}
            title={isSidebarCollapsed ? "Standard Catalog" : ""}
          >
            <span>🌐</span> {!isSidebarCollapsed && "Standard Catalog"}
          </div>
          {isAuthenticated && (
            <div
              className={`sidebar-nav-item ${activeTab === "catalog" && viewMode === "developer" ? "active" : ""}`}
              onClick={() => { setActiveTab("catalog"); setViewMode("developer"); }}
              style={{ justifyContent: isSidebarCollapsed ? "center" : "flex-start", padding: isSidebarCollapsed ? "10px 0" : "10px 12px" }}
              title={isSidebarCollapsed ? "Developer Workspace" : ""}
            >
              <span>🛠️</span> {!isSidebarCollapsed && "Developer Workspace"}
            </div>
          )}
          {isAuthenticated && sessionRoles.includes("ADMIN") && (
            <>
              <div
                className={`sidebar-nav-item ${activeTab === "catalog" && viewMode === "admin" ? "active" : ""}`}
                onClick={() => { setActiveTab("catalog"); setViewMode("admin"); }}
                style={{ justifyContent: isSidebarCollapsed ? "center" : "flex-start", padding: isSidebarCollapsed ? "10px 0" : "10px 12px" }}
                title={isSidebarCollapsed ? "Admin Workspace" : ""}
              >
                <span>🛡️</span> {!isSidebarCollapsed && "Admin Workspace"}
              </div>

              {!isSidebarCollapsed && <div className="sidebar-nav-header">Management</div>}
              <div
                className={`sidebar-nav-item ${activeTab === "tags" ? "active" : ""}`}
                onClick={() => { setActiveTab("tags"); }}
                style={{ justifyContent: isSidebarCollapsed ? "center" : "flex-start", padding: isSidebarCollapsed ? "10px 0" : "10px 12px" }}
                title={isSidebarCollapsed ? "Manage Tags" : ""}
              >
                <span>🏷️</span> {!isSidebarCollapsed && "Manage Tags"}
              </div>
              <div
                className={`sidebar-nav-item ${activeTab === "users" ? "active" : ""}`}
                onClick={() => { setActiveTab("users"); }}
                style={{ justifyContent: isSidebarCollapsed ? "center" : "flex-start", padding: isSidebarCollapsed ? "10px 0" : "10px 12px" }}
                title={isSidebarCollapsed ? "Manage Users" : ""}
              >
                <span>👥</span> {!isSidebarCollapsed && "Manage Users"}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* --- Right Column: Main Workspace --- */}
      <div className="app-main">
        {/* 1. Global Header */}
        <header className="app-header">
          <div className="brand-section">
            <h1 className="brand-title" style={{ fontSize: "16px", textTransform: "none", letterSpacing: "normal" }}>
              {activeTab === "catalog" ? (
                <>GenAI Capability Registry &mdash; <span style={{ color: "var(--border-focus)", fontWeight: "600" }}>{viewMode === "public" ? "Standard Catalog" : viewMode === "developer" ? "Developer Workspace" : "Admin Workspace"}</span></>
              ) : activeTab === "tags" ? (
                "Tag Governance Control Center"
              ) : (
                "IAM User & Role Provisioning Console"
              )}
            </h1>
          </div>

          <div className="header-controls">
            {/* Theme Selector Toggle */}
            <button
              className="role-selector"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              style={{ display: "flex", gap: "8px", alignItems: "center", cursor: "pointer" }}
              id="theme-toggle-button"
              title="Toggle Visual Theme (Light/Dark)"
            >
              <span style={{ fontSize: "13px", fontWeight: 700 }}>
                {theme === "light" ? "🌙 Dark" : "☀️ Light"}
              </span>
            </button>

            {/* Premium Profile Dropdown */}
            <div style={{ display: "flex", alignItems: "center", borderLeft: "1px solid var(--border-color)", paddingLeft: "16px" }}>
              {isAuthenticated ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button
                    type="button"
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "6px", 
                      background: "none", 
                      border: "none", 
                      cursor: "pointer", 
                      padding: "4px 8px",
                      borderRadius: "var(--radius-md)",
                      transition: "all 0.15s ease",
                      outline: "none"
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-light)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    title="User Profile Options"
                  >
                    <div className="user-avatar" style={{ 
                      width: "28px", 
                      height: "28px", 
                      borderRadius: "50%", 
                      background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", 
                      color: "#ffffff", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      fontWeight: "800", 
                      fontSize: "11px",
                      boxShadow: "0 2px 4px rgba(0, 122, 135, 0.15)"
                    }}>
                      {currentUser ? currentUser.substring(0, 2).toUpperCase() : "U"}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "2px" }}>▼</span>
                  </button>

                  {isProfileDropdownOpen && (
                    <>
                      {/* Backdrop overlay to close dropdown on outer clicks */}
                      <div 
                        onClick={() => setIsProfileDropdownOpen(false)}
                        style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                      />
                      {/* Dropdown panel */}
                      <div style={{ 
                        position: "absolute", 
                        right: 0, 
                        marginTop: "8px", 
                        width: "180px", 
                        backgroundColor: "var(--bg-secondary)", 
                        border: "1px solid var(--border-color)", 
                        borderRadius: "var(--radius-md)", 
                        boxShadow: "var(--shadow-lg)", 
                        zIndex: 999,
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        boxSizing: "border-box"
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.2" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>{currentUser}</span>
                          <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: "2px" }}>
                            {sessionRoles.includes("ADMIN") ? "Administrator" : "Standard User"}
                          </span>
                        </div>
                        
                        <div style={{ height: "1px", backgroundColor: "var(--border-color)", margin: "4px 0" }} />
                        
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            setIsSelfPasswordOpen(true);
                          }}
                          style={{ 
                            fontSize: "10px", 
                            color: "var(--text-primary)", 
                            backgroundColor: "transparent",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-sm)",
                            padding: "6px 10px",
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            gap: "6px", 
                            fontWeight: "700",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            width: "100%",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            boxSizing: "border-box"
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--primary-light)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          🔑 Update Password
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            handleLogout();
                          }}
                          style={{ 
                            fontSize: "10px", 
                            color: "var(--danger)", 
                            backgroundColor: "rgba(239, 68, 68, 0.05)",
                            border: "1px solid rgba(239, 68, 68, 0.12)",
                            borderRadius: "var(--radius-sm)",
                            padding: "6px 10px",
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            gap: "6px", 
                            fontWeight: "700",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            width: "100%",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            boxSizing: "border-box"
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.12)";
                          }}
                        >
                          <span>🔒</span> Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setLoginModalTab("login");
                    setIsLoginModalOpen(true);
                  }}
                  style={{ padding: "8px 16px", fontSize: "13px", fontWeight: "700", display: "flex", gap: "6px", alignItems: "center" }}
                  id="btn-open-login"
                >
                  🔑 Log In / Register
                </button>
              )}
            </div>
          </div>
        </header>



      {/* 3. Main Split Layout */}
      {activeTab === "catalog" && (
        <main className="main-content">
        
        {/* Left column: Catalog search/filters & Card grid */}
        <div className="content-area">
          
          {/* Search and Filters Bar */}
          <div className="panel" style={{ padding: "12px 20px" }}>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
              
              <div style={{ flex: 1, minWidth: "200px" }}>
                <input
                  type="text"
                  placeholder="Fuzzy search capability name, descriptions, owners..."
                  className="form-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  id="catalog-search-input"
                />
              </div>

              <div style={{ width: "160px" }}>
                <select
                  className="form-select"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  id="catalog-filter-type"
                >
                  <option value="">All Types</option>
                  <option value="agent">Agents</option>
                  <option value="plugin">Plugins</option>
                  <option value="skill">Skills</option>
                </select>
              </div>

              <div style={{ width: "180px" }}>
                <select
                  className="form-select"
                  value={selectedHarness}
                  onChange={(e) => setSelectedHarness(e.target.value)}
                  style={{ backgroundColor: "var(--bg-primary)" }}
                  id="catalog-filter-harness"
                >
                  <option value="">All Harnesses</option>
                  <option value="claude">Claude Code / OpenCode</option>
                  <option value="github-copilot">GitHub Copilot IDE</option>
                  <option value="codex">Codex / Codex CLI</option>
                </select>
              </div>

              {(viewMode === "admin" || viewMode === "developer") && (
                <div style={{ width: "180px" }}>
                  <select
                    className="form-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    style={{ backgroundColor: "var(--bg-primary)" }}
                    id="catalog-filter-status"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    {viewMode === "developer" && <option value="draft">Draft</option>}
                    {viewMode === "developer" && <option value="rejected">Rejected</option>}
                  </select>
                </div>
              )}

              {(search || selectedType || selectedHarness || selectedStatus) && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: "6px 12px" }}
                  onClick={() => {
                    setSearch("");
                    setSelectedType("");
                    setSelectedHarness("");
                    setSelectedStatus("");
                  }}
                >
                  Reset
                </button>
              )}
              {viewMode === "developer" && (
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: "6px" }}
                  onClick={() => setIsImportModalOpen(true)}
                  id="btn-import-capability"
                >
                  + Import Bundle
                </button>
              )}
            </div>
          </div>

          {/* Loading / Error States */}
          {loading && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
              Retrieving capability logs from relational schema...
            </div>
          )}

          {!loading && error && (
            <div className="panel" style={{ borderColor: "var(--danger)" }}>
              <p style={{ color: "var(--danger)", fontWeight: "600" }}>Error: {error}</p>
            </div>
          )}

          {/* Empty Grid Placeholder */}
          {!loading && capabilities.length === 0 && (
            <div className="panel" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No capabilities found matching the specified parameters.
            </div>
          )}

          {/* Grid of Capabilities */}
          {!loading && capabilities.length > 0 && (
            <div className="cards-grid">
              {capabilities.map((cap) => {
                const isSelected = selectedCapability?.id === cap.id;
                const lowerType = cap.type.toLowerCase();
                
                return (
                  <div
                    key={cap.id}
                    className={`capability-card card-${lowerType}`}
                    style={{ borderColor: isSelected ? "var(--border-focus)" : "var(--border-color)" }}
                    onClick={() => handleCardClick(cap)}
                  >
                    <div className="card-top">
                      <div>
                        <h3 className="card-title">{cap.name}</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                          <span className="card-version">v{cap.latestVersion.version}</span>
                          {(viewMode === "developer" || viewMode === "admin") && renderStatusBadge(cap.latestVersion.status)}
                        </div>
                      </div>
                      {renderTypeBadge(cap.type)}
                    </div>
                    
                    <p className="card-desc">{cap.description}</p>
                    
                    {cap.tags && cap.tags.length > 0 && (
                      <div className="tag-badge-container" style={{ marginBottom: "12px", marginTop: "-4px" }}>
                        {cap.tags.map((tag: any) => (
                          <span
                            key={tag.id}
                            className="tag-badge"
                            style={{ backgroundColor: tag.color, fontSize: "10px", padding: "2px 8px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (search === tag.name) {
                                setSearch("");
                              } else {
                                setSearch(tag.name);
                              }
                            }}
                            title={`Filter by tag: ${tag.name}`}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="card-bottom">
                      <div className="card-harnesses">
                        {cap.latestVersion.harnesses.map((h, i) => (
                          <span key={i} className="badge badge-harness">{h}</span>
                        ))}
                        {cap.latestVersion.harnesses.length === 0 && (
                          <span className="badge badge-harness" style={{ opacity: 0.5 }}>Standard Manual</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Adaptive Detail Drawer or Administration Diff View */}
        {selectedCapability && selectedVersion && (
          <div className="sidebar" style={{ width: viewMode === "admin" && selectedVersion.status === "PENDING_REVIEW" ? "640px" : "440px" }}>
            
            {/* Capability Drawer Container */}
            <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Drawer Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "800" }}>{selectedCapability.name}</h2>
                    {renderTypeBadge(selectedCapability.type)}
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Owned by: {selectedCapability.owner}</p>
                </div>
                
                <button
                  className="btn btn-secondary"
                  style={{ padding: "4px 8px", fontSize: "11px" }}
                  onClick={() => {
                    setSelectedCapability(null);
                    setSelectedVersion(null);
                  }}
                >
                  ✕ Close
                </button>
              </div>

              {/* Version History Selector */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Version Audit Log</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    className="form-select"
                    value={selectedVersion.id}
                    onChange={handleVersionChange}
                    style={{ flex: 1 }}
                    id="version-history-select"
                  >
                    {selectedCapability.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} — {v.status.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  {renderStatusBadge(selectedVersion.status)}
                </div>
              </div>

              {/* Adaptive UI Tabs based on perspective and status */}
              {/* --- SCENARIO 1: Viewing Active Production version or General Catalog --- */}
              {selectedVersion.status === "ACTIVE" && (
                <div>
                  <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px", color: "var(--text-secondary)" }}>
                    Installation
                  </h4>
                  
                  {(() => {
                    const supportedHarnessList = [
                      { id: "claude", label: "Claude Code" },
                      { id: "opencode", label: "OpenCode" },
                      { id: "codex", label: "Codex/CLI" },
                      { id: "github-copilot", label: "GHCP Agent" },
                      { id: "ghcp", label: "GHCP Agent" }
                    ];
                    const declaredHarnesses = selectedVersion.harnesses || [];
                    const visibleHarnessTabs = supportedHarnessList.filter(sh => declaredHarnesses.includes(sh.id));
                    const uniqueVisibleHarnessTabs: typeof supportedHarnessList = [];
                    visibleHarnessTabs.forEach(tab => {
                      if (!uniqueVisibleHarnessTabs.some(u => u.label === tab.label)) {
                        uniqueVisibleHarnessTabs.push(tab);
                      }
                    });
                    
                    return uniqueVisibleHarnessTabs.length > 0 ? (
                      <>
                        {/* Harness Selector Tabs */}
                        <div className="details-tab-controller">
                          {uniqueVisibleHarnessTabs.map((tab, i) => (
                            <div
                              key={i}
                              className={`details-env-tab ${activeInstallTab === tab.id ? "active" : ""}`}
                              onClick={() => setActiveInstallTab(tab.id)}
                            >
                              {tab.label}
                            </div>
                          ))}
                        </div>

                        {/* Terminal code snippet display */}
                        <div className="install-command-box">
                          <div className="install-code">
                            {getInstallCommand(selectedCapability.name, selectedVersion.version, activeInstallTab)}
                          </div>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "var(--bg-secondary)" }}
                            onClick={() => {
                              navigator.clipboard.writeText(
                                getInstallCommand(selectedCapability.name, selectedVersion.version, activeInstallTab)
                              );
                              alert("Terminal command copied to clipboard!");
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", marginBottom: "12px" }}>
                        This capability is registered as a Standard Manual. No automated installation harness configurations are required.
                      </p>
                    );
                  })()}

                  <button
                    onClick={handleDownloadZip}
                    className="btn btn-secondary"
                    style={{ width: "100%", textAlign: "center", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer" }}
                  >
                    📦 Download Universal Bundle (.zip)
                  </button>

                  {/* ROLLBACK Option for Admin on Active version */}
                  {viewMode === "admin" && selectedCapability.versions.length > 1 && (
                    <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
                      <button
                        className="btn btn-danger"
                        style={{ width: "100%" }}
                        onClick={() => handleStatusTransition("ROLLBACK", selectedVersion.id)}
                      >
                        🚨 Rollback Active Production Version
                      </button>
                      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", textAlign: "center" }}>
                        One-click production deprecation. Instantly reinstates the previous secure snapshot.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* --- SCENARIO 2: Developer view of Draft, Rejected, Active, or Inactive versions --- */}
              {viewMode === "developer" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                    Developer Operations
                  </h4>

                  {(selectedVersion.status === "DRAFT" || selectedVersion.status === "REJECTED") && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleStatusTransition("SUBMIT_REVIEW", selectedVersion.id)}
                    >
                      🚀 Submit Version for Administrative Review
                    </button>
                  )}

                  {selectedVersion.status === "PENDING_REVIEW" && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleStatusTransition("CANCEL_REVIEW", selectedVersion.id)}
                      style={{ color: varColor("warning") }}
                    >
                      ✕ Cancel Pending Review Request
                    </button>
                  )}

                  {selectedVersion.status === "ACTIVE" && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleStatusTransition("DEACTIVATE", selectedVersion.id)}
                    >
                      ⏸ Inactivate Active Capability
                    </button>
                  )}

                  {selectedVersion.status === "INACTIVE" && (
                    <button
                      className="btn btn-success"
                      onClick={() => handleStatusTransition("ACTIVATE", selectedVersion.id)}
                    >
                      ▶ Re-activate Inactive Capability
                    </button>
                  )}

                  {(selectedVersion.status === "DRAFT" || selectedVersion.status === "INACTIVE" || selectedVersion.status === "REJECTED") && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteVersion(selectedVersion.id, selectedVersion.version, selectedCapability.name)}
                      style={{ marginTop: "6px" }}
                    >
                      🗑️ Delete Version v{selectedVersion.version}
                    </button>
                  )}
                </div>
              )}

              {/* --- SCENARIO 3: Admin Review Queue & Governance Auditing --- */}
              {viewMode === "admin" && (selectedVersion.status === "PENDING_REVIEW" || selectedVersion.status === "ACTIVE" || selectedVersion.status === "INACTIVE" || selectedVersion.status === "REJECTED" || selectedVersion.status === "DRAFT") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                    <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px", color: "var(--text-secondary)" }}>
                      Governance Controls
                    </h4>
                    
                    {selectedVersion.status === "PENDING_REVIEW" && (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
                          <label className="form-label" style={{ fontSize: "11px", marginBottom: 0 }}>Associate Governance Tags</label>
                          {allTags.length === 0 ? (
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No tags available. Navigate to Manage Tags to create them.</span>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", backgroundColor: "var(--bg-tertiary)", padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                              {allTags.map((tag) => {
                                const isChecked = selectedTagIdsForApproval.includes(tag.id);
                                return (
                                  <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer", userSelect: "none" }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedTagIdsForApproval(prev => prev.filter(id => id !== tag.id));
                                        } else {
                                          setSelectedTagIdsForApproval(prev => [...prev, tag.id]);
                                        }
                                      }}
                                    />
                                    <span className="tag-badge" style={{ backgroundColor: tag.color, fontSize: "10px", padding: "1px 6px" }}>
                                      {tag.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          className="btn btn-success"
                          style={{ flex: 1 }}
                          onClick={() => handleStatusTransition("APPROVE", selectedVersion.id)}
                        >
                          ✓ Approve Release
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ flex: 1 }}
                          onClick={() => handleStatusTransition("REJECT", selectedVersion.id)}
                        >
                          ✕ Reject & Block
                        </button>
                      </div>
                      </>
                    )}

                    {selectedVersion.status === "ACTIVE" && (
                      <button
                        className="btn btn-danger"
                        style={{ width: "100%" }}
                        onClick={() => handleStatusTransition("DEACTIVATE", selectedVersion.id)}
                      >
                        ⏸ Inactivate Active Capability
                      </button>
                    )}

                    {selectedVersion.status === "INACTIVE" && (
                      <button
                        className="btn btn-success"
                        style={{ width: "100%" }}
                        onClick={() => handleStatusTransition("ACTIVATE", selectedVersion.id)}
                      >
                        ▶ Re-activate Inactive Capability
                      </button>
                    )}

                    {(selectedVersion.status === "DRAFT" || selectedVersion.status === "INACTIVE" || selectedVersion.status === "REJECTED") && (
                      <button
                        className="btn btn-danger"
                        style={{ width: "100%", marginTop: "8px" }}
                        onClick={() => handleDeleteVersion(selectedVersion.id, selectedVersion.version, selectedCapability.name)}
                      >
                        🗑️ Delete Version v{selectedVersion.version}
                      </button>
                    )}
                  </div>

                  {/* Visual Diffs Section (Only for Pending Review items) */}
                  {selectedVersion.status === "PENDING_REVIEW" && (
                    <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                      <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px", color: "var(--text-secondary)" }}>
                        Granular Code-Diff Engine
                      </h4>

                      {loadingDiff && <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Calculating code path changes...</p>}

                      {!loadingDiff && diffData && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {diffData.isFirstVersion
                              ? "First version ever uploaded. All prompts are new additions."
                              : `Comparing v${selectedVersion.version} changes against v${diffData.previousVersion}`}
                          </p>

                          <div className="form-group" style={{ margin: 0 }}>
                            <select
                              className="form-select"
                              value={selectedDiffFile?.fileName || ""}
                              onChange={(e) => {
                                const found = diffData.diffs.find((d) => d.fileName === e.target.value);
                                if (found) setSelectedDiffFile(found);
                              }}
                            >
                              {diffData.diffs.map((d, i) => (
                                <option key={i} value={d.fileName}>
                                  {d.fileName} {d.hasChanges ? "✎" : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          {selectedDiffFile && (
                            <div className="diff-container">
                              <div className="diff-file-header">
                                <span>{selectedDiffFile.fileName}</span>
                                <span style={{ color: selectedDiffFile.hasChanges ? "var(--warning)" : "var(--success)" }}>
                                  {selectedDiffFile.hasChanges ? "Modified" : "Unchanged"}
                                </span>
                              </div>
                              <div className="diff-content">
                                {selectedDiffFile.diffParts.map((part, idx) => {
                                  let lineClass = "diff-line-unchanged";
                                  let prefix = "  ";
                                  if (part.added) {
                                    lineClass = "diff-line-added";
                                    prefix = "+ ";
                                  } else if (part.removed) {
                                    lineClass = "diff-line-removed";
                                    prefix = "- ";
                                  }
                                  return (
                                    <span key={idx} className={`diff-line ${lineClass}`}>
                                      {prefix}{part.value}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Description & Metadata Panel */}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px", color: "var(--text-secondary)" }}>
                  Metadata Description
                </h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                  {selectedCapability.description}
                </p>
                <div style={{ display: "flex", gap: "10px", marginTop: "12px", fontSize: "11px", color: "var(--text-muted)" }}>
                  <span>Created: {new Date(selectedCapability.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Updated: {new Date(selectedVersion.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Universal Bundle File Explorer */}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "10px", color: "var(--text-secondary)" }}>
                  Universal Bundle Explorer
                </h4>
                
                {loadingFileTree && <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Reading bundle directory...</p>}
                
                {!loadingFileTree && fileTree.length > 0 && (
                  <div className="tree-container">
                    {renderFileTree(fileTree)}
                  </div>
                )}

                {!loadingFileTree && fileTree.length === 0 && (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
                    No files found in this bundle.
                  </p>
                )}

                {/* File Contents Code Viewer Panel */}
                {selectedFilePath && (
                  <div className="file-viewer-panel">
                    <div className="file-viewer-header">
                      <span>{selectedFilePath}</span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                        onClick={() => {
                          setSelectedFilePath(null);
                          setSelectedFileContent(null);
                        }}
                      >
                        ✕ Close File
                      </button>
                    </div>
                    {loadingFileContent ? (
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px" }}>Reading content...</p>
                    ) : (
                      <pre className="file-viewer-content">
                        <code>{selectedFileContent}</code>
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Review Audit log & Comments Section */}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "10px", color: "var(--text-secondary)" }}>
                  Review Comments Thread
                </h4>

                <div className="comments-thread" style={{ marginBottom: "12px" }}>
                  {selectedVersion.comments && selectedVersion.comments.map((comment) => (
                    <div key={comment.id} className="comment-bubble">
                      <div className="comment-header">
                        <span className={`comment-author author-${comment.author.toLowerCase()}`}>
                          {comment.author}
                        </span>
                        <span className="comment-date">
                          {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="comment-text">{comment.text}</div>
                    </div>
                  ))}
                  {(!selectedVersion.comments || selectedVersion.comments.length === 0) && (
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
                      No comments logged on this version release yet.
                    </p>
                  )}
                </div>

                {/* Add Comment Input Form */}
                {isAuthenticated && viewMode !== "public" ? (
                  <form onSubmit={handleAddComment} style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder={`Reply as ${viewMode === "admin" ? "Admin" : "Developer"}...`}
                      className="form-input"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      style={{ flex: 1 }}
                      id="comments-thread-input"
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submittingComment || !newCommentText.trim()}
                      style={{ padding: "8px 12px" }}
                    >
                      Send
                    </button>
                  </form>
                ) : (
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", marginTop: "10px" }}>
                    Please log in or register as a developer to post comments thread replies.
                  </p>
                )}
              </div>

            </div>
          </div>
        )}

      </main>
      )}

      {/* --- Tag Management View Panel --- */}
      {activeTab === "tags" && sessionRoles.includes("ADMIN") && (
        <main className="main-content" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="panel" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "700" }}>Manage Metadata & Compliance Tags</h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Create and manage classification tags which admins can associate with capabilities during governance review.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setIsCreateTagOpen(true)}>
                + Create New Tag
              </button>
            </div>

            {allTags.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>No tags found in database. Seed the database or create one above.</p>
              </div>
            ) : (
              <div className="dashboard-grid">
                {allTags.map((tag) => (
                  <div key={tag.id} className="dashboard-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="tag-badge" style={{ backgroundColor: tag.color }}>
                        {tag.name}
                      </span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "11px", color: "var(--status-rejected)" }}
                        onClick={() => handleDeleteTag(tag.id)}
                      >
                        Delete
                      </button>
                    </div>
                    {tag.description && (
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", marginTop: "4px" }}>
                        {tag.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* --- User Provisioning View Panel --- */}
      {activeTab === "users" && sessionRoles.includes("ADMIN") && (
        <main className="main-content" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="panel" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "700" }}>Provision & Manage IAM Users</h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Create secure user credentials and assign roles (User or Admin) for governance boundaries.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setIsCreateUserOpen(true)}>
                + Create New User
              </button>
            </div>

            {loadingUsers ? (
              <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Loading provisioned users...</p>
            ) : allUsers.length === 0 ? (
              <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>No users provisioned.</p>
            ) : (
              <div className="dashboard-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Assigned Permission Roles</th>
                      <th>Date Provisioned</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((user) => (
                      <tr key={user.id}>
                        <td style={{ fontWeight: "600" }}>👤 {user.username}</td>
                        <td>
                          {user.roles.split(",").map((role: string) => (
                            <span
                              key={role}
                              className={`status-badge status-${role === "ADMIN" ? "active" : "inactive"}`}
                              style={{ marginRight: "6px", fontSize: "10px", padding: "2px 6px" }}
                            >
                              {role}
                            </span>
                          ))}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "var(--bg-secondary)" }}
                            onClick={() => {
                              setSelectedUserForPasswordUpdate(user);
                              setIsUpdatePasswordOpen(true);
                            }}
                          >
                            🔑 Change Password
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      )}

      {/* --- Login & Registration Tabbed Modal Overlay --- */}
      {isLoginModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header" style={{ paddingBottom: 0 }}>
              <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid var(--border-color)", width: "100%" }}>
                <button
                  type="button"
                  style={{
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: loginModalTab === "login" ? "2px solid var(--primary)" : "2px solid transparent",
                    color: loginModalTab === "login" ? "var(--primary)" : "var(--text-muted)",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    outline: "none"
                  }}
                  onClick={() => {
                    setLoginModalTab("login");
                    setLoginError(null);
                    setRegisterError(null);
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  style={{
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: loginModalTab === "register" ? "2px solid var(--primary)" : "2px solid transparent",
                    color: loginModalTab === "register" ? "var(--primary)" : "var(--text-muted)",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    outline: "none"
                  }}
                  onClick={() => {
                    setLoginModalTab("register");
                    setLoginError(null);
                    setRegisterError(null);
                  }}
                  id="tab-register"
                >
                  Register
                </button>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px", position: "absolute", right: "20px", top: "20px" }}
                onClick={() => {
                  setIsLoginModalOpen(false);
                  setLoginUsername("");
                  setLoginPassword("");
                  setRegisterUsername("");
                  setRegisterPassword("");
                  setRegisterConfirmPassword("");
                  setLoginError(null);
                  setRegisterError(null);
                }}
              >
                ✕
              </button>
            </div>

            {loginModalTab === "login" ? (
              <form onSubmit={handleLogin}>
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "20px" }}>
                  {loginError && (
                    <div className="panel" style={{ padding: "10px", borderColor: "var(--danger)", backgroundColor: "rgba(239, 68, 68, 0.05)", margin: 0 }}>
                      <p style={{ color: "var(--danger)", fontSize: "12px", fontWeight: "600", textAlign: "center", margin: 0 }}>
                        ⚠️ {loginError}
                      </p>
                    </div>
                  )}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      placeholder="Enter username..."
                      className="form-input"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      placeholder="Enter password..."
                      className="form-input"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer" style={{ borderTop: "none" }}>
                  <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "10px" }} disabled={authenticating}>
                    {authenticating ? "Logging in..." : "Login"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "20px" }}>
                  {registerError && (
                    <div className="panel" style={{ padding: "10px", borderColor: "var(--danger)", backgroundColor: "rgba(239, 68, 68, 0.05)", margin: 0 }}>
                      <p style={{ color: "var(--danger)", fontSize: "12px", fontWeight: "600", textAlign: "center", margin: 0 }}>
                        ⚠️ {registerError}
                      </p>
                    </div>
                  )}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">User ID (Username)</label>
                    <input
                      type="text"
                      placeholder="Choose alphanumeric username..."
                      className="form-input"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      required
                      id="register-username"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      placeholder="Enter password (min 6 chars)..."
                      className="form-input"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      id="register-password"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Confirm Password</label>
                    <input
                      type="password"
                      placeholder="Confirm password..."
                      className="form-input"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      required
                      id="register-confirm-password"
                    />
                  </div>
                </div>
                <div className="modal-footer" style={{ borderTop: "none" }}>
                  <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "10px" }} disabled={registering} id="btn-submit-register">
                    {registering ? "Registering..." : "Create Account & Login"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- Create Tag Modal Overlay --- */}
      {isCreateTagOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Create New Classification Tag</h3>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px" }}
                onClick={() => setIsCreateTagOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTag}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tag Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Model-Dev"
                    className="form-input"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tag Hex Color Accent</label>
                  <select
                    className="form-select"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                  >
                    <option value="#ef4444">🔴 Red (Critical / Security)</option>
                    <option value="#10b981">🟢 Green (Production Safe)</option>
                    <option value="#f59e0b">🟡 Amber (Experimental)</option>
                    <option value="#3b82f6">🔵 Blue (Agentic)</option>
                    <option value="#8b5cf6">🟣 Purple (MCP Standard)</option>
                    <option value="#0d9488">🟢 Teal (Corporate Standard)</option>
                    <option value="#6b7280">⚫ Slate (Default)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    placeholder="Provide a brief explanation of what this tag signifies..."
                    className="form-textarea"
                    value={newTagDesc}
                    onChange={(e) => setNewTagDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateTagOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Create User Modal Overlay --- */}
      {isCreateUserOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Provision New IAM Credentials</h3>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px" }}
                onClick={() => setIsCreateUserOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    placeholder="e.g. duc"
                    className="form-input"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    placeholder="Enter password..."
                    className="form-input"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Assign Permissions Roles</label>
                  <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newUserRoles.includes("USER")}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUserRoles(prev => [...prev, "USER"]);
                          } else {
                            setNewUserRoles(prev => prev.filter(r => r !== "USER"));
                          }
                        }}
                      />
                      Standard User Role
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newUserRoles.includes("ADMIN")}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUserRoles(prev => [...prev, "ADMIN"]);
                          } else {
                            setNewUserRoles(prev => prev.filter(r => r !== "ADMIN"));
                          }
                        }}
                      />
                      Administrator Role
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateUserOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Update User Password Modal Overlay --- */}
      {isUpdatePasswordOpen && selectedUserForPasswordUpdate && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Update Password for {selectedUserForPasswordUpdate.username}</h3>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px" }}
                onClick={() => {
                  setIsUpdatePasswordOpen(false);
                  setSelectedUserForPasswordUpdate(null);
                  setNewUserPasswordUpdate("");
                  setConfirmUserPassword("");
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePassword}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password..."
                    className="form-input"
                    value={newUserPasswordUpdate}
                    onChange={(e) => setNewUserPasswordUpdate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password..."
                    className="form-input"
                    value={confirmUserPassword}
                    onChange={(e) => setConfirmUserPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsUpdatePasswordOpen(false);
                    setSelectedUserForPasswordUpdate(null);
                    setNewUserPasswordUpdate("");
                    setConfirmUserPassword("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={updatingPassword}>
                  {updatingPassword ? "Updating..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Personal Self Password Update Modal Overlay --- */}
      {isSelfPasswordOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Update Your Password</h3>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px" }}
                onClick={() => {
                  setIsSelfPasswordOpen(false);
                  setSelfOldPassword("");
                  setSelfNewPassword("");
                  setSelfConfirmPassword("");
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSelfUpdatePassword}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Current Old Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password..."
                    className="form-input"
                    value={selfOldPassword}
                    onChange={(e) => setSelfOldPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password..."
                    className="form-input"
                    value={selfNewPassword}
                    onChange={(e) => setSelfNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password..."
                    className="form-input"
                    value={selfConfirmPassword}
                    onChange={(e) => setSelfConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsSelfPasswordOpen(false);
                    setSelfOldPassword("");
                    setSelfNewPassword("");
                    setSelfConfirmPassword("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={selfUpdating}>
                  {selfUpdating ? "Updating..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Right-Column Wrapper closing tags --- */}
      </div>

      {/* 4. Import / Ingestion Modal Overlay */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "550px" }}>
            
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Import GenAI Capability Bundle</h3>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px" }}
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStep("upload");
                  setParsedMetadata(null);
                  setSelectedFile(null);
                  setGitUrl("");
                  setGitTag("");
                  setImportComment("");
                  setImportError(null);
                }}
              >
                ✕
              </button>
            </div>

            {importStep === "upload" ? (
              <form onSubmit={handleImportSubmit}>
                <div className="modal-body">
                  <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>Step 1 of 2:</span>
                    <span style={{ color: "var(--text-muted)" }}>Upload ZIP or Git Repository</span>
                  </div>

                  {importError && (
                    <div className="panel" style={{ borderColor: "var(--danger)", padding: "10px 14px", marginBottom: "14px" }}>
                      <p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>{importError}</p>
                    </div>
                  )}

                  {/* Import Type Toggle */}
                  <div className="form-group">
                    <label className="form-label">Ingestion Source Type</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <label
                        className="btn btn-secondary"
                        style={{
                          flex: 1,
                          backgroundColor: importType === "file" ? "var(--border-color)" : "transparent",
                          borderColor: importType === "file" ? "var(--border-focus)" : "var(--border-color)",
                          cursor: "pointer"
                        }}
                        onClick={() => setImportType("file")}
                      >
                        📁 Upload Local ZIP Bundle
                      </label>
                      <label
                        className="btn btn-secondary"
                        style={{
                          flex: 1,
                          backgroundColor: importType === "git" ? "var(--border-color)" : "transparent",
                          borderColor: importType === "git" ? "var(--border-focus)" : "var(--border-color)",
                          cursor: "pointer"
                        }}
                        onClick={() => setImportType("git")}
                      >
                        🔗 Enterprise Git Repository
                      </label>
                    </div>
                  </div>

                  {importType === "file" ? (
                    <div className="form-group">
                      <label className="form-label">Universal Capability ZIP Bundle</label>
                      <input
                        type="file"
                        accept=".zip"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setSelectedFile(file);
                        }}
                      />
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => fileInputRef.current?.click()}
                          style={{ flex: 1 }}
                          id="btn-choose-bundle-zip"
                        >
                          Choose File
                        </button>
                        <span style={{ flex: 2, display: "flex", alignItems: "center", fontSize: "12px", color: "var(--text-secondary)" }}>
                          {selectedFile ? selectedFile.name : "No file selected"}
                        </span>
                      </div>
                      <span className="form-help">Optionally includes '.capability.json' in bundle root.</span>

                      {/* Quick Demo Preloads */}
                      <div style={{ marginTop: "14px", borderTop: "1px solid var(--border-color)", paddingTop: "10px" }}>
                        <label className="form-label" style={{ fontSize: "11px" }}>Local Demo Preloaded Bundles</label>
                        <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={async () => {
                              try {
                                const res = await fetch("/mock_bundles/weather-agent-bundle.zip");
                                const blob = await res.blob();
                                const file = new File([blob], "weather-agent-v1.1.0.zip", { type: "application/zip" });
                                setSelectedFile(file);
                                setImportComment("Pushing v1.1.0 update to weather-agent bundle.");
                                alert("Loaded preloaded Weather Agent (v1.1.0) test bundle!");
                              } catch (e) {
                                alert("Mock bundle not loaded directly. You can manually upload a ZIP from the workspace 'mock_bundles' directory.");
                              }
                            }}
                          >
                            Weather Agent (Patch)
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={async () => {
                              try {
                                const res = await fetch("/mock_bundles/security-playbook-bundle.zip");
                                const blob = await res.blob();
                                const file = new File([blob], "security-playbook-v1.0.0.zip", { type: "application/zip" });
                                setSelectedFile(file);
                                setImportComment("Updating security playbook SOP to OAuth2 compliant v1.0.0.");
                                alert("Loaded preloaded Security Playbook (v1.0.0) test bundle!");
                              } catch (e) {
                                alert("Mock bundle not loaded directly. You can manually upload a ZIP from the workspace 'mock_bundles' directory.");
                              }
                            }}
                          >
                            Security Playbook (Update)
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">Enterprise Repository Git URL</label>
                        <input
                          type="text"
                          placeholder="https://github.corp.ema.ai/architecture/mcp-plugin"
                          className="form-input"
                          value={gitUrl}
                          onChange={(e) => setGitUrl(e.target.value)}
                          id="git-import-url"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Release Tag / Branch</label>
                        <input
                          type="text"
                          placeholder="v1.2.0"
                          className="form-input"
                          value={gitTag}
                          onChange={(e) => setGitTag(e.target.value)}
                          id="git-import-tag"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setImportError(null);
                      setSelectedFile(null);
                      setGitUrl("");
                      setGitTag("");
                      setImportComment("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={importing}
                    id="btn-submit-capability-form"
                  >
                    {importing ? "Processing..." : "Verify & Parse"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleImportConfirm}>
                <div className="modal-body">
                  <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>Step 2 of 2:</span>
                    <span style={{ color: "var(--text-muted)" }}>Verify Metadata & Governance</span>
                  </div>

                  {importError && (
                    <div className="panel" style={{ borderColor: "var(--danger)", padding: "10px 14px", margin: "12px 0" }}>
                      <p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>{importError}</p>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
                    {parsedMetadata?.hasManifest ? (
                      <div className="panel" style={{ borderColor: "var(--success)", backgroundColor: "rgba(16, 185, 129, 0.03)", padding: "10px 14px", margin: 0 }}>
                        <p style={{ color: "var(--success)", fontSize: "12px", fontWeight: "600", margin: 0 }}>
                          ✓ MASTER CONFIGURATION DETECTED: Found '.capability.json' in bundle root. You can review and edit the entries below.
                        </p>
                      </div>
                    ) : (
                      <div className="panel" style={{ borderColor: "var(--warning)", backgroundColor: "rgba(245, 158, 11, 0.03)", padding: "10px 14px", margin: 0 }}>
                        <p style={{ color: "var(--warning)", fontSize: "12px", fontWeight: "600", margin: 0 }}>
                          ⚠️ MISSING MASTER CONFIGURATION: No '.capability.json' manifest was found in the bundle root. Please enter the required capability metadata below to register it.
                        </p>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Capability Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. model-developer"
                          className="form-input"
                          value={enteredName}
                          onChange={(e) => setEnteredName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Semantic Version *</label>
                        <input
                          type="text"
                          placeholder="e.g. 1.0.0"
                          className="form-input"
                          value={enteredVersion}
                          onChange={(e) => setEnteredVersion(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Registered Owner *</label>
                        <input
                          type="text"
                          placeholder="e.g. Quantitative Research Team"
                          className="form-input"
                          value={enteredOwner}
                          onChange={(e) => setEnteredOwner(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Derived Type (Governance)</label>
                        <div style={{ display: "flex", alignItems: "center", height: "38px" }}>
                          <span className={`badge badge-${enteredType.toLowerCase()}`} style={{ padding: "4px 10px", fontSize: "11px" }}>
                            {enteredType}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Description *</label>
                      <textarea
                        placeholder="Describe what this capability does..."
                        className="form-textarea"
                        value={enteredDescription}
                        onChange={(e) => setEnteredDescription(e.target.value)}
                        required
                        style={{ height: "60px" }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Client Harnesses Compatibility (Select at least one) *</label>
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", flexWrap: "wrap" }}>
                        {[
                          { id: "claude", label: "Claude Code" },
                          { id: "opencode", label: "OpenCode" },
                          { id: "codex", label: "Codex/CLI" },
                          { id: "ghcp", label: "GHCP Agent" }
                        ].map((h) => (
                          <label key={h.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={enteredHarnesses.includes(h.id) || (h.id === "ghcp" && enteredHarnesses.includes("github-copilot"))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEnteredHarnesses(prev => [...prev, h.id]);
                                } else {
                                  setEnteredHarnesses(prev => prev.filter(x => x !== h.id && (h.id !== "ghcp" || x !== "github-copilot")));
                                }
                              }}
                            />
                            {h.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: "14px", marginBottom: 0 }}>
                    <label className="form-label">Submission & Review Comments</label>
                    <textarea
                      placeholder="Provide details about the change history, prompt security additions, or skill execution constraints..."
                      className="form-textarea"
                      value={importComment}
                      onChange={(e) => setImportComment(e.target.value)}
                      id="import-comment-textarea"
                      style={{ height: "50px" }}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setImportStep("upload");
                      setImportError(null);
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={importing}
                  >
                    {importing ? "Importing..." : "Confirm & Import"}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// Quick helper to color variables dynamically if needed in inline styles
function varColor(variable: string): string {
  if (typeof window === "undefined") return "";
  return `var(--${variable})`;
}
