## Development

https://dbdiagram.io/d/crushingviz-67e04bc275d75cc844257e09

#### Run migrations
Migrations now live in `packages/data`. See that package's README.
```bash
bun packages/data/migrate.ts up;
```

#### Reverse migrations
```bash
bun packages/data/migrate.ts down;
```
