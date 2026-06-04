"""Pydantic schemas for the Agentathon API surface."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FlexibleModel(BaseModel):
    class Config:
        extra = "allow"


class AgentathonRunRequest(FlexibleModel):
    run_id: Optional[str] = Field(default=None)
    use_case_id: str = Field(default="21")
    input: Dict[str, Any] = Field(default_factory=dict)
    options: Dict[str, Any] = Field(default_factory=dict)


class AgentDescriptor(FlexibleModel):
    name: str
    role: str


class AgentTraceEvent(FlexibleModel):
    timestamp: str
    trace_id: str
    run_id: str = ""
    agent_name: str
    action: str
    input_summary: str = ""
    output_summary: str = ""
    target_agent: str = ""
    confidence: float = 0.0
    retry_count: int = 0
    status: str = "success"
    tool_used: str = ""
    memory_key: str = ""
    payload: Dict[str, Any] = Field(default_factory=dict)


class RunOutput(FlexibleModel):
    summary: str
    decision: str
    risk_level: str
    required_actions: List[str] = Field(default_factory=list)
    human_review_required: bool = True
    artifacts: List[Dict[str, Any]] = Field(default_factory=list)


class AgentathonRunResponse(FlexibleModel):
    run_id: str
    status: str
    use_case_id: str
    output: RunOutput
    agents: List[AgentDescriptor]
    agent_trace: List[AgentTraceEvent]
    trace_id: str
    log_file: str
    execution_time_seconds: float
