# React Event Handlers Rule

## Problem

TypeScript errors when passing functions directly to onClick:

```tsx
// ❌ Type error
<button onClick={logout}>Logout</button>
<button onClick={login}>Login</button>
```

## Root Cause

React onClick expects `MouseEventHandler<HTMLButtonElement>` which receives `MouseEvent` as parameter, not a function returning void.

## Solution

Always wrap function calls in arrow functions:

```tsx
// ✅ Correct
<button onClick={() => logout()}>Logout</button>
<button onClick={() => login()}>Login</button>

// ✅ With parameters
<button onClick={() => handleDelete(id)}>Delete</button>

// ✅ Function references without parameters are okay
<button onClick={handleSubmit}>Submit</button>
```

## Validation

Before committing, run:

```bash
npm run typecheck
```

Should pass without `Type '() => void' is not assignable to type 'MouseEventHandler'` errors.
