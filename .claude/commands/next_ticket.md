---
name: next ticket
description: Read the next ticket and begin working on it.
---

# Next Ticket and Scope of Work

Use a generic subagent (NOT the base agent) to read plan/EPIC.md to understand the overall plan and find the next incomplete ticket.

Use the base agent to read that ticket from plan/ and begin working on it.

If a corresponding TICKET-###-implementation-plan.md DOES NOT exist, continue to the "## PLAN" section below, then STOP.

If a corresponding TICKET-###-implementation-plan.md DOES exist, read it and continue to the "## IMPLEMENTATION" section below.

## PLAN

Create a new file in plan/ named TICKET-###-implementation-plan.md, where ### is the ticket number. In this file, outline a detailed plan for implementing the ticket. This should include a breakdown of the tasks needed to create the ticket in one or more stages, with checkboxes to mark each task as complete.

After creating the implementation plan, commit it and then STOP and wait for further instructions. DO NOT begin implementation until instructed to do so.

## IMPLEMENTATION

Begin working on the next stage of the ticket's implementation plan.

Ensure that you follow best practices for coding, including

- Writing clean, maintainable code
- Adding comments where necessary
- Writing tests to cover new functionality

If the task involves multiple steps or components, break down the work into manageable parts and tackle them one at a time using generic subagents if a task is complex.

Use version control effectively, committing changes frequently with clear messages and including the ticket number in the commits.

Use Test-Driven Development (TDD) where applicable, writing tests before implementing the functionality to ensure that the code meets the requirements.

Before commiting any changes, run tests and linting tools on the appropriate files to ensure code quality and functionality.

ALWAYS commit changes at the end of a stage and note the commit hash in the ticket file in plan/.

### Documentation

While working on the task, update the notes in the ticket file in plan/ as with what you do and implement, as well as the reasons behind your choices.

### Finishing an Implementation Task

When you finish a stage in the ticket's implementation plan, mark it as complete in the TICKET-###-implementation-plan.md file and ensure your notes have been updated in the ticket file in plan/. Then STOP and wait for further instructions. DO NOT proceed to the next stage until instructed to do so.

### Finishing a Ticket

When you finish the ticket (i.e. the last task of the ticket's implementation plan), first run the product manager agent to ensure all requirements have been met.

- If they have not, assign new tasks to the implementation plan with detailed notes and STOP.
- If they have, mark the ticket as complete in the ticket file in plan/ and include all commit hashes done as part of the work. Then mark it as complete in the epic file plan/EPIC.md. Update the CLAUDE.md file, the README.md file, and any other relevant documentation to reflect the changes made in the ticket.

DO NOT proceed to the next ticket until instructed to do so.
