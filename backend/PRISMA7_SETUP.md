# Prisma 7 Setup - Modern Configuration

**Date:** 2026-02-06
**Prisma Version:** 7.3.0
**Database:** PostgreSQL 16+

---

## Why Relative Imports?

This project uses **Prisma 7's modern `prisma-client` provider**, which requires direct imports from the generated output location.

### ❌ This Does NOT Work:
```typescript
import { PrismaClient } from '@prisma/client';
```

### ✅ This DOES Work (Prisma 7 Standard):
```typescript
import { PrismaClient } from '../../prisma/generated/client';
```

---

## Configuration

### Schema (prisma/schema.prisma)
```prisma
generator client {
  provider = "prisma-client"  // Modern Prisma 7 provider
  output   = "./generated"    // REQUIRED in Prisma 7
}

datasource db {
  provider = "postgresql"
  // URL configured in prisma.config.ts
}
```

### Config (prisma.config.ts)
```typescript
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### Import Pattern
```typescript
// src/prisma/prisma.service.ts
import { PrismaClient } from '../../prisma/generated/client';
```

---

## Why Use `prisma-client` Provider?

| Feature | `prisma-client` (New) | `prisma-client-js` (Old) |
|---------|----------------------|--------------------------|
| **Performance** | 3x faster queries | Baseline |
| **Bundle Size** | 90% smaller | Baseline |
| **Architecture** | Rust-free | Rust dependencies |
| **Status** | ✅ Recommended | ⚠️ Deprecated |
| **Output Path** | Required | Optional |
| **Import** | Direct from output | `@prisma/client` |

---

## Benefits of This Setup

### 1. **Performance** ⚡
- **3x faster queries** - No Rust-to-JavaScript bridge overhead
- **90% smaller bundles** - Reduced deployment size
- **Lower memory usage** - Better for containerized deployments

### 2. **Future-Proof** 🔮
- Uses latest Prisma 7 architecture
- `prisma-client-js` will be removed in future releases
- Aligned with Prisma's long-term direction

### 3. **Explicit & Clear** 📍
- Generated code location is obvious
- No hidden node_modules magic
- Easier to understand for new team members

---

## Common Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name description

# Apply migrations (production)
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio

# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

---

## Why Not Use `@prisma/client` Import?

The `@prisma/client` package import **only works with the deprecated `prisma-client-js` provider**.

To use `@prisma/client` import, you'd need:

```prisma
generator client {
  provider = "prisma-client-js"  // Deprecated!
}
```

**Downsides:**
- ❌ Slower performance (Rust overhead)
- ❌ Larger bundles
- ❌ Deprecated, will be removed
- ❌ Misses Prisma 7 benefits

**We chose NOT to do this** because the performance and future-proofing benefits of the modern provider outweigh the convenience of the `@prisma/client` import.

---

## Team Onboarding

When new developers join:

1. **After cloning the repo:**
   ```bash
   npm install
   npx prisma generate  # Generate the Prisma Client
   ```

2. **Imports will work from:**
   ```typescript
   import { PrismaClient } from '../../prisma/generated/client';
   ```

3. **No need to:**
   - Install `@prisma/client` separately (it's a dependency)
   - Configure anything special
   - Worry about module resolution

---

## Troubleshooting

### "Module not found: prisma/generated/client"

**Solution:** Run `npx prisma generate`

The generated folder is in `.gitignore`, so it needs to be regenerated after cloning.

### "Property '$connect' does not exist"

**Solution:**
1. Delete `prisma/generated/` folder
2. Run `npx prisma generate`
3. Rebuild: `npm run build`

### Type errors after schema changes

**Solution:**
```bash
npx prisma generate  # Regenerate types
npm run build        # Rebuild TypeScript
```

---

## References

- [Prisma 7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Generators Reference](https://www.prisma.io/docs/orm/prisma-schema/overview/generators)
- [Prisma Client Setup](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client)

---

## Summary

✅ **This is the correct Prisma 7 setup**
✅ **Relative imports are the standard for `prisma-client` provider**
✅ **We get 3x performance improvement and 90% smaller bundles**
✅ **Future-proof for upcoming Prisma releases**

**The `@prisma/client` import is NOT the Prisma 7 standard anymore!**
