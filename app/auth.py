"""Centralized FastAPI authentication, authorization, and tenant scope.

The evaluator API supports the same configured demo bearer token as the Node
runtime.  Tenant identifiers come from server configuration, never request
bodies, so callers cannot select another workspace or project.
"""

from __future__ import annotations

import hmac
import os
import re
from dataclasses import dataclass
from typing import FrozenSet, Optional

from fastapi import Depends, Header, HTTPException, status


DEFAULT_WORKSPACE_ID = "agentathon"
DEFAULT_PROJECT_ID = "use-case-21"
SCOPE_RE = re.compile(r"[^A-Za-z0-9_.:-]+")
LEARNING_REVIEWER_ROLES: FrozenSet[str] = frozenset(
    {
        "platform_admin",
        "risk_admin",
        "compliance_reviewer",
        "legal_privacy_reviewer",
        "security_reviewer",
        "finance_project_reviewer",
        "hse_bcm_reviewer",
    }
)
AUDIT_READER_ROLES: FrozenSet[str] = frozenset({"platform_admin", "auditor"})


def _clean_scope(value: Optional[str], fallback: str) -> str:
    cleaned = SCOPE_RE.sub("-", str(value or "").strip()).strip(".-:")
    return cleaned[:128] or fallback


def _roles(value: Optional[str]) -> FrozenSet[str]:
    return frozenset(
        role.strip().lower().replace("-", " ").replace(" ", "_")
        for role in str(value or "").split(",")
        if role.strip()
    )


def auth_mode() -> str:
    configured = os.environ.get("P42_AUTH_MODE", "audit").strip().lower()
    return configured if configured in {"audit", "enforced"} else "enforced"


@dataclass(frozen=True)
class AuthContext:
    authenticated: bool
    mode: str
    actor_id: str
    roles: FrozenSet[str]
    workspace_id: str
    project_id: str

    def scope(self) -> dict[str, str]:
        return {"workspaceId": self.workspace_id, "projectId": self.project_id}

    def actor(self) -> dict[str, str]:
        return {"mode": self.mode, "id": self.actor_id}


def _server_context(*, authenticated: bool, roles: FrozenSet[str]) -> AuthContext:
    return AuthContext(
        authenticated=authenticated,
        mode=auth_mode(),
        actor_id=(os.environ.get("P42_DEMO_ACTOR_ID") or "demo-operator") if authenticated else "anonymous",
        roles=roles,
        workspace_id=_clean_scope(
            os.environ.get("P42_DEMO_WORKSPACE_ID") or os.environ.get("P42_WORKSPACE_ID"),
            DEFAULT_WORKSPACE_ID,
        ),
        project_id=_clean_scope(
            os.environ.get("P42_DEMO_PROJECT_ID") or os.environ.get("P42_PROJECT_ID"),
            DEFAULT_PROJECT_ID,
        ),
    )


async def request_auth_context(authorization: Optional[str] = Header(default=None)) -> AuthContext:
    """Authenticate the configured bearer token and attach server-side scope."""

    configured_token = os.environ.get("P42_DEMO_BEARER_TOKEN") or ""
    supplied = str(authorization or "").strip()
    if supplied:
        scheme, separator, token = supplied.partition(" ")
        valid = bool(
            separator
            and scheme.lower() == "bearer"
            and configured_token
            and hmac.compare_digest(token.strip(), configured_token)
        )
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid bearer token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return _server_context(
            authenticated=True,
            roles=_roles(os.environ.get("P42_DEMO_ROLES") or "compliance_reviewer,auditor"),
        )

    if auth_mode() == "enforced":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _server_context(authenticated=False, roles=frozenset({"demo_user"}))


async def require_learning_reviewer(
    context: AuthContext = Depends(request_auth_context),
) -> AuthContext:
    """Require an authenticated reviewer or administrator for memory writes."""

    if not context.authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Reviewer bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if context.roles.isdisjoint(LEARNING_REVIEWER_ROLES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reviewer or administrator role required.",
        )
    return context


async def require_audit_reader(
    context: AuthContext = Depends(request_auth_context),
) -> AuthContext:
    """Require an authenticated auditor or platform administrator."""

    if not context.authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auditor bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if context.roles.isdisjoint(AUDIT_READER_ROLES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auditor or platform administrator role required.",
        )
    return context
