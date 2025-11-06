---
name: next task
description: Read the next task and begin working on it.
---

# Next Task and Scope of Work

Use the task-navigator subagent to find the next incomplete ticket and **task**. The subagent will provide concise output in this format:

```
Next Ticket: TICKET-XXX
Title: [Brief ticket title]
Implementation Plan: [EXISTS | DOES NOT EXIST]
Next Stage: [Stage name/number | N/A]
Next Task: [Task description | N/A]
Stage File: [TICKET-XXX-stage-N.md | N/A]
```

Use the base agent to read that ticket from plan/ and begin working on it.

If a corresponding TICKET-###-implementation-plan.md DOES NOT exist, continue to the "## PLAN" section below, then STOP.

If a corresponding TICKET-###-implementation-plan.md DOES exist, read it and the stage file, then continue to the "## IMPLEMENTATION" section below.

## PLAN

When creating an implementation plan, you will create **multiple files**:

1. **Main Implementation Plan**: `plan/TICKET-###-implementation-plan.md`
2. **Stage Files**: `plan/TICKET-###-stage-N.md` (one per stage)

### Main Implementation Plan Structure

Create `plan/TICKET-###-implementation-plan.md` with this structure:

```markdown
# TICKET-### Implementation Plan

## Ticket

[Link to ticket: See [TICKET-###.md](TICKET-###.md)]

## Overview

[High-level description of what will be implemented and the overall approach]

## Architecture Considerations

[Important context, patterns, or decisions that apply across all stages:

- Design patterns to follow
- Dependencies between stages
- Technology choices and rationale
- Integration points with existing code]

## Implementation Stages

| Stage           | Status      | File                                           |
| --------------- | ----------- | ---------------------------------------------- |
| Stage 1: [Name] | not started | [TICKET-###-stage-1.md](TICKET-###-stage-1.md) |
| Stage 2: [Name] | not started | [TICKET-###-stage-2.md](TICKET-###-stage-2.md) |
| Stage 3: [Name] | not started | [TICKET-###-stage-3.md](TICKET-###-stage-3.md) |

**Status Values:**

- `not started` - Stage has not been begun
- `in progress` - At least one task complete, but not all
- `complete` - All tasks in stage are complete

## Progress Notes

[Add notes here as implementation progresses:

- Key decisions made during implementation
- Challenges encountered and solutions
- Changes from original plan
- Important discoveries about the codebase]

## Commit History

[Updated as stages are completed:]

- Stage 1: `<commit-hash>` - [Brief description]
- Stage 2: `<commit-hash>` - [Brief description]
```

### Stage File Structure

Create one file per stage: `plan/TICKET-###-stage-N.md`

Each stage file should follow this structure:

```markdown
# TICKET-### - Stage N: [Stage Name]

## Goal

[What this stage accomplishes - the specific deliverable]

## Context

[Information specific to this stage:

- Prerequisites or dependencies
- Files that will be modified
- Patterns to follow from existing code
- Specific considerations for this stage]

## Tasks

### Development Tasks

- [ ] [Specific, actionable development task]
- [ ] [Another development task]
- [ ] [etc.]

### Testing Tasks

[Only include this section for stages that involve code changes]

- [ ] Write unit tests for [specific functionality]
- [ ] Write integration tests for [specific functionality]
- [ ] [Additional test tasks as needed]

### Quality Assurance Tasks

[Only include this section for stages that involve code changes]

- [ ] Run tests (use TypeScript Tester subagent)
- [ ] Fix test failures (if any exist from previous task)
- [ ] Run type-check and lint (use TypeScript Fixer subagent)
- [ ] Fix type/lint errors (if any exist from previous task)

### Review and Commit Tasks

[Only include this section for stages that involve code changes]

- [ ] Run code review (use Code Reviewer subagent - MANDATORY)
- [ ] Address code review feedback (if any exists from previous task)
- [ ] Commit stage changes with detailed conventional commit message

## Implementation Notes

[Add notes here as tasks are completed:

- Implementation decisions made
- Issues encountered and resolutions
- Code patterns used
- Important findings]

## Commit Hash

[Added when final commit task is complete]
```

### Creating the Plan

1. Read the ticket from `plan/TICKET-###.md` thoroughly
2. Create the main implementation plan file with:
   - Clear overview of the approach
   - Architecture considerations that apply across stages
   - Table of stages with appropriate names
3. Create all stage files upfront with:
   - Clear, specific tasks (small enough to complete in one context)
   - Development tasks first
   - Testing tasks next (only for code stages)
   - Quality tasks (tests, lint) next (only for code stages)
   - Review and commit tasks last (only for code stages)
4. **For stages that only involve documentation or configuration** (no code changes):
   - Include only development tasks
   - Omit testing, quality, and review/commit sections
   - These stages may still need a final commit task if changes are made
5. Commit the plan files with message:

   ```
   docs(plan): create implementation plan for TICKET-###

   Created main plan and N stage files breaking down the work into
   manageable tasks. Each stage focuses on [brief summary].

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

After creating and committing the implementation plan, **STOP** and wait for further instructions. DO NOT begin implementation until instructed to do so.

## IMPLEMENTATION

You are now working at **task-level granularity**, not stage-level. This means:

- Work on the **single task** identified by task-navigator
- Mark that task as complete when done
- Update stage status in main plan if needed (first task → "in progress", last task → "complete")
- **STOP** after completing the task
- User will run `/next_task` again for the next task

### Task Execution Guidelines

1. **Read the context**: Review both the main plan and the stage file to understand:
   - Overall architecture considerations
   - Stage-specific context
   - The specific task you're working on
   - How it fits into the larger stage

2. **Execute the task**: Follow best practices:
   - Write clean, maintainable code
   - Add comments where necessary
   - Use TDD when appropriate (write test tasks before implementation)
   - **Delegate research to Explore subagent** to save context

3. **Mark the task complete**: Update the checkbox in the stage file from `- [ ]` to `- [x]`

4. **Update status if needed**:
   - If this was the **first task** in a stage: Update stage status to "in progress" in main plan
   - If this was the **last task** in a stage: Update stage status to "complete" in main plan
   - Add commit hash to stage file if this was the final commit task

5. **STOP**: Do not proceed to the next task

### Context Management

**IMPORTANT**: When you need to research or gather information, ALWAYS delegate to subagents to save context:

- **Code Research**: Use Explore subagent (subagent_type="Explore") for:
  - Understanding how existing features work
  - Finding similar implementations or patterns
  - Exploring the codebase structure
  - Gathering context about specific areas of code
  - Searching for specific symbols, files, or patterns

- **Complex Multi-Step Tasks**: Use general-purpose subagents when appropriate

- **Information Lookup**: Use subagents to search documentation or gather examples

### Special Task Types

#### Testing Tasks

- Write tests directly (base agent writes tests)
- Follow existing test patterns in the codebase
- Use TDD: tests should be written before implementation when appropriate

#### "Run tests" Tasks

- **NEVER run tests directly** - ALWAYS use TypeScript Tester subagent
- Mark this task complete after the subagent runs
- If tests fail, the next task ("Fix test failures") handles it

#### "Fix test failures" Tasks

- Only applicable if previous "run tests" task found failures
- Fix the implementation code to make tests pass
- Use TypeScript Tester subagent to verify fixes
- If no failures exist, mark this task complete immediately with note "No failures to fix"

#### "Run type-check and lint" Tasks

- **NEVER run directly** - ALWAYS use TypeScript Fixer subagent
- Mark task complete after subagent runs
- If errors found, next task ("Fix type/lint errors") handles it

#### "Fix type/lint errors" Tasks

- Only applicable if previous task found errors
- TypeScript Fixer subagent will handle the fixes
- If no errors exist, mark this task complete immediately with note "No errors to fix"

#### "Run code review" Tasks

- **MANDATORY** - Use Code Reviewer subagent
- Mark task complete after subagent provides feedback
- Next task handles addressing the feedback

#### "Address code review feedback" Tasks

- Review the feedback from previous task
- **Critical issues**: MUST be fixed before proceeding
- **Non-critical suggestions**: Determine whether to:
  - Fix now (do it in this task)
  - Fix later (add new tasks/stage to plan)
  - Ignore (document why in implementation notes)
- Mark complete when critical issues are resolved

#### "Commit" Tasks

- Review all changes made in the stage
- Write detailed conventional commit message explaining:
  - What changed (concise summary)
  - Why it changed (implementation decisions, context)
  - Reference ticket number
- Use HEREDOC format for multi-line messages
- Include Claude Code attribution footer
- After committing successfully:
  - Add commit hash to stage file's "Commit Hash" section
  - Update stage status to "complete" in main plan
  - Update "Commit History" section in main plan
- Mark task complete

### Updating Plan Files

As you work:

1. **Stage file**:
   - Mark tasks complete as you finish them: `- [ ]` → `- [x]`
   - Add notes to "Implementation Notes" section
   - Add commit hash when final commit is done

2. **Main plan**:
   - Update stage status when first task starts: "not started" → "in progress"
   - Update stage status when last task completes: "in progress" → "complete"
   - Add commit hash to "Commit History" section when stage completes
   - Add progress notes to "Progress Notes" section as needed

### Code Review

The "Run code review" task is **MANDATORY** for every stage that involves code changes. The Code Reviewer subagent will analyze:

- Best practices and code quality
- Security vulnerabilities
- Performance issues
- Unnecessary complexity
- Type safety and error handling
- Project convention adherence

**Handling Code Review Feedback:**

If the code review returns **critical issues**:

- These MUST be fixed in the "Address code review feedback" task
- Re-run code review if significant changes were made

If the code review returns **non-critical suggestions**:

- **Fix now**: If simple and in scope, fix in the "Address code review feedback" task
- **Fix later**: If complex or out of scope, add new tasks to a new stage in the plan
- **Ignore**: If not applicable, document why in implementation notes

If creating a new stage for deferred improvements:

1. Add the new stage to the main plan table
2. Create a new stage file with detailed tasks
3. Note in current stage's implementation notes why this was deferred

### Finishing a Stage

When you complete the last task in a stage (typically the commit task):

1. Verify all tasks in the stage file are marked `[x]`
2. Ensure commit hash is recorded in stage file
3. Update stage status to "complete" in main plan table
4. Update "Commit History" in main plan
5. **STOP** - do not proceed to the next stage

The next invocation of `/next_task` will automatically pick up the first task of the next stage.

### Finishing a Ticket

When the last stage of the ticket's implementation plan is complete (i.e., all stages show "complete" status):

1. **MANDATORY**: Run the Project Manager subagent to verify all requirements are met

   ```
   Use Task tool with project-manager subagent to verify ticket completion
   ```

2. **If requirements are NOT met**:
   - Add new stages to the implementation plan with detailed tasks
   - Update main plan table with new stages
   - Create new stage files
   - **STOP** and continue implementation

3. **If requirements ARE met**:
   - Mark ticket as complete in `plan/TICKET-###.md`
   - Include all commit hashes in the ticket file
   - Mark ticket as complete in `plan/EPIC.md`
   - Update `CLAUDE.md` if project conventions changed
   - Update `README.md` if user-facing features were added
   - Update any other relevant documentation (feature docs in `docs/features/`)
   - Commit documentation updates

4. **STOP** - DO NOT proceed to the next ticket until instructed

## Documentation During Implementation

Throughout task execution:

1. **Stage file notes**: Add to "Implementation Notes" section:
   - Why you chose a particular approach
   - Challenges and how you solved them
   - Code patterns used and why
   - Important findings about the codebase

2. **Main plan notes**: Add to "Progress Notes" section:
   - High-level decisions affecting multiple stages
   - Changes from original plan
   - Discoveries that change understanding
   - Cross-cutting concerns

3. **Ticket file**: Update the notes section with:
   - Summary of what was implemented
   - Key architectural decisions
   - Links to relevant documentation created

## Best Practices

- **Small tasks**: Each task should be completable in a single context (~5-15 minutes of work)
- **Clear descriptions**: Task descriptions should be specific and actionable
- **Logical ordering**: Tasks should build on previous tasks
- **Quality gates**: Testing, linting, and review tasks ensure quality at each stage
- **Context efficiency**: One task per execution = fresh context for each piece of work
- **Documentation**: Keep notes updated as you go, don't wait until the end

## Example Workflow

**Initial planning** (user runs `/next_task` for first time):

1. task-navigator reports: "Implementation Plan: DOES NOT EXIST"
2. Create main plan with 3 stages
3. Create 3 stage files with detailed tasks
4. Commit plan files
5. **STOP**

**First implementation task** (user runs `/next_task` again):

1. task-navigator reports: "Next Task: Create Prisma schema for conditions table"
2. Read main plan for architecture considerations
3. Read stage 1 file for stage-specific context
4. Create the Prisma schema
5. Mark task complete in stage file
6. Update stage status to "in progress" in main plan
7. **STOP**

**Second implementation task** (user runs `/next_task` again):

1. task-navigator reports: "Next Task: Generate Prisma migration"
2. Read stage file for context
3. Generate migration
4. Mark task complete
5. **STOP**

**Continue until stage complete...**

**Code review task**:

1. task-navigator reports: "Next Task: Run code review"
2. Use Code Reviewer subagent
3. Mark task complete
4. **STOP**

**Address feedback task**:

1. task-navigator reports: "Next Task: Address code review feedback"
2. Review feedback from previous context
3. Fix critical issues
4. Mark task complete
5. **STOP**

**Final commit task**:

1. task-navigator reports: "Next Task: Commit stage changes with detailed message"
2. Review all changes in stage
3. Commit with detailed conventional message
4. Add commit hash to stage file
5. Update stage status to "complete" in main plan
6. Mark task complete
7. **STOP**

**Next stage begins automatically when user runs `/next_task`**

## Summary

- **Work at task-level** - One task per execution
- **Use subagents** - Delegate research, testing, fixing, and review
- **Update files** - Keep stage file and main plan synchronized
- **STOP after each task** - Let user drive progress with `/next_task`
- **Quality gates** - Tests, linting, and code review in every code stage
- **Document as you go** - Implementation notes in both files
