---
name: next ticket
description: Read the next ticket and begin working on it.
---

# Next Ticket

Use a generic subagent (NOT the base agent) to read plan/EPIC.md to understand the overall plan and find the next incomplete ticket.

Use the base agent to read that ticket from plan/ and begin working on it.

## Implementation

Ensure that you follow best practices for coding, including

- Writing clean, maintainable code
- Adding comments where necessary
- Writing tests to cover new functionality

If the ticket involves multiple steps or components, break down the work into manageable parts and tackle them one at a time using generic subagents if a task is complex.

Use version control effectively, committing changes frequently with clear messages and including the ticket number in the commits.

Use Test-Driven Development (TDD) where applicable, writing tests before implementing the functionality to ensure that the code meets the requirements.

Before commiting any changes, run tests and linting tools on the appropriate files to ensure code quality and functionality.

## Documentation

While working on the ticket, update the notes in the ticket file in plan/ as with what you do and implement, as well as the reasons behind your choices.

When you finish the ticket, mark it as complete in the ticket file in plan/ and include all commit hashes done as part of the work. Then mark it as complete in the epic file plan/EPIC.md. Update the CLAUDE.md file, the README.md file, and any other relevant documentation to reflect the changes made in the ticket.

## Completion

After this, stop and wait for further instructions.
