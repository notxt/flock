# Flock Project Code Style Guide

## TypeScript Configuration

- Use TypeScript with the strictest settings
- Enable all strict mode flags in tsconfig.json
- Never use `any` type - be explicit about types
- Prefer explicit return types on all functions

## Code Style Principles

### Functional Programming
- Write pure functions, avoid side effects
- No classes or object-oriented patterns
- Use `const` exclusively, no `let` or `var`
- Prefer immutable data structures
- Use array methods (map, filter, reduce) over loops

### Type Definitions
- Always use `type` instead of `interface`
- Avoid generics unless absolutely necessary
- Write concrete types for specific use cases
- Keep types close to their usage

### Null Handling
- Use `null` for missing values, never `undefined`
- No optional properties - all object properties should be required
- Use explicit union types like `string | null`

## Error Handling

### No Throwing
- Never use `throw` statements
- Return error values: `T | Error`
- Make all errors visible in function signatures
- Example:
  ```typescript
  function parseConfig(input: string): Config | Error {
    // Don't throw, return Error instead
  }
  ```

### Try-Catch Usage
- Keep try blocks minimal - one statement only
- Each catch handles one specific error source
- Provide specific error messages
- Example:
  ```typescript
  // ✅ Good
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (e) {
    return new Error("Invalid JSON input");
  }
  
  // ❌ Bad - try block too large
  try {
    const data = JSON.parse(input);
    const result = processData(data);
    return result;
  } catch (e) {
    return new Error("Operation failed");
  }
  ```

## Development Environment

- Use Node.js 24 (specified in .nvmrc)
- ESLint enforces all code style rules
- Development server for local testing
- GitHub Actions for continuous integration

## Available Scripts

- `npm run dev > log/dev.log 2>&1 &` - Start development server with file watching (Node.js watch mode) as background process
- `npm run build` - Build TypeScript client code to JavaScript
- `npm run watch > log/watch.log 2>&1 &` - Build TypeScript client code in watch mode for continuous compilation as background process
- `npm test` - Run Playwright end-to-end tests

## Code Organization

- Pure functions at module level
- Group related functions in files
- Clear, descriptive function names
- Minimal dependencies between modules