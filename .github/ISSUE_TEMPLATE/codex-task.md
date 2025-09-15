name: Codex Task
about: Atomic, well-scoped task for Codex agent
labels: [codex]
body:
  - type: textarea
    id: goal
    attributes:
      label: Goal (single outcome statement)
      description: Clear description of desired behavior/result
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria (checkboxes)
      value: |
        - [ ] Tests cover the behavior
        - [ ] Feature flags OFF = no change
        - [ ] CI green; preview guarded on missing secrets
        - [ ] Docs updated
  - type: textarea
    id: context
    attributes:
      label: Context / references
      description: Links to files, prior PRs, designs
  - type: textarea
    id: approach
    attributes:
      label: Suggested approach
      description: Optional; let Codex propose if blank

