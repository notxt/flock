Please analyze and fix the GitHub issue: $ARGUMENTS.

Follow these steps:

1. Use `gh issue view` to get the issue details
2. Create a new branch to work on
3. Use a subagent to
    - think about problem described in the issue
    - search the codebase for relevant files
    - create an implementation plan
5. Use a subagent to
    - Write acceptance tests for the implementation plan
    - Implement the the plan using test driven development (TDD) where possible
    - Run all tests to check for any regressions
    - Ensure code passes linting and type checking
8. Create a descriptive commit message
9. Push and create a PR

Remember to use the GitHub CLI (`gh`) for all GitHub-related tasks.