Claude Code generated the following output when asked about Go modules and packages

**Go Modules vs Packages**

### **Module = Repository/Project**
A module is defined by a `go.mod` file. Think of it like `package.json` in Node.js.

```
crushingviz/
└── packages/
    └── api/
        ├── go.mod          ← This defines the MODULE
        └── ...
```

Your `go.mod` says:
```go
module crushingviz.info/api
```

This means: "This entire directory tree is one module named `crushingviz.info/api`"

### **Package = Directory with .go files**
A package is a directory containing `.go` files that all start with the same `package` declaration.

```
packages/api/
├── go.mod                    ← MODULE ROOT
├── main.go                   ← package main
├── handlers/
│   ├── api.go                ← package handlers
│   └── health.go             ← package handlers
└── types/
    └── types.go              ← package types
```

**Rule**: All `.go` files in the same directory must have the same `package` declaration.

## **Your Specific Issues Explained**

### **Issue #1: Why remove `types/go.mod`?**

You had:
```
packages/api/
├── go.mod                    ← Module: crushingviz.info/api
└── types/
    ├── go.mod                ← Module: crushingviz.info/api/types (WRONG!)
    └── types.go
```

**This created TWO modules**, which is almost never what you want. Go got confused because `tygo` saw the inner `go.mod` and thought `types` was a separate module, not a package within the `api` module.

**Correct structure:**
```
packages/api/
├── go.mod                    ← ONE module
└── types/
    └── types.go              ← Just a package
```

Now `types` is a **package inside the module**, which is what you want.

### **Issue #2: Why `package types` not `package main`?**

Every `.go` file must declare which package it belongs to:

```go
package types  // This file belongs to the "types" package
```

**Special case: `package main`**

`package main` is magic in Go. It means "this is an executable program". A `package main` must have a `func main()` which is the entry point.

```go
// main.go
package main

func main() {
    // Program starts here
}
```

**Your types.go had:**
```go
package main  // ← Wrong! This isn't an executable

func main() {  // ← Wrong! This isn't the entry point
}
```

This told Go: "This file is an executable program". But it's not - it's just type definitions for other code to import.

**Correct:**
```go
package types  // This is a library package, not executable

// No main() function needed
```

### **Issue #5: Why remove `func main()`?**

Following from #2, since this is `package types` (a library), it doesn't need a `main()` function. Only `package main` needs that.

## **How Go Imports Work**

With the correct structure:

```go
// packages/api/main.go
package main

import "crushingviz.info/api/types"  // Import the types package

func main() {
    var data types.ACLEDWeeklyAggregate
    // ...
}
```

The import path is: `module_name + directory_path`

```
crushingviz.info/api + /types = crushingviz.info/api/types
     ↑                    ↑
  (from go.mod)      (directory)
```

## **Common Go Patterns**

### **Single executable:**
```
myapp/
├── go.mod              (module myapp.com/project)
├── main.go             (package main)
├── handlers/
│   └── api.go          (package handlers)
└── types/
    └── types.go        (package types)
```

### **Multiple executables (what you DON'T have):**
```
myapp/
├── go.mod              
├── cmd/
│   ├── server/
│   │   └── main.go     (package main)
│   └── worker/
│       └── main.go     (package main)
└── internal/
    └── types/
        └── types.go    (package types)
```

### **Multiple modules (with go.work - what you DO have):**
```
crushingviz/
├── go.work                    ← Workspace
├── packages/
│   ├── api/
│   │   ├── go.mod             ← Module 1
│   │   ├── main.go            (package main)
│   │   └── types/
│   │       └── types.go       (package types)
│   └── scraper/               ← Potential future module
│       ├── go.mod             ← Module 2
│       └── main.go            (package main)
```

## **Quick Reference**

| Concept | File | Purpose | How Many? |
|---------|------|---------|-----------|
| **Module** | `go.mod` | Defines a Go project/dependency unit | One per service/library |
| **Package** | `package xyz` at top of `.go` files | Groups related code | Many per module |
| **Workspace** | `go.work` | Links multiple modules together | One per monorepo (optional) |

## **Your Setup Now (Correct)**

```
crushingviz/
├── go.work                         ← Workspace (optional but nice)
│   use ./packages/api
│
└── packages/
    └── api/                        
        ├── go.mod                  ← Module: crushingviz.info/api
        ├── main.go                 ← package main (executable)
        └── types/                  
            └── types.go            ← package types (library)
